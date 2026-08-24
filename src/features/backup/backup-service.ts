import "server-only";

import { stat } from "node:fs/promises";
import { BackupProgressStage, BackupType, JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { acquireJobLock, anyHeavyJobRunning } from "@/lib/db/locks";
import { getEnv } from "@/lib/config/env";
import { assertBackupAllowed } from "@/lib/config/issues";
import { parseEncryptionKey } from "@/lib/crypto/key";
import { encryptFileAes256Gcm, verifyEncryptedFileChecksum } from "@/lib/crypto/aes";
import { sha256File } from "@/lib/crypto/checksum";
import { generateBackupFileName } from "@/lib/crypto/filename";
import { postgresCommandRunner } from "@/lib/postgres/command-runner";
import { parsePostgresUrl, toPgEnv } from "@/lib/postgres/url";
import { getSourceHealth } from "@/lib/postgres/source";
import {
  createTempDumpPath,
  ensureBackupDir,
  resolveBackupPath,
  safeUnlink,
  setRestrictiveFileMode,
} from "@/lib/storage/paths";
import { getDiskUsage } from "@/lib/storage/disk";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { childLogger } from "@/lib/logger";
import { audit, AuditActions } from "@/lib/audit";
import { applyRetention } from "@/features/backup/retention";
import { notifyBackupResult } from "@/features/notifications/email-service";
import { getSystemSettings } from "@/lib/db/settings";
import { computeNextScheduledBackupAt } from "@/lib/scheduler/next-run";

const DUMP_TIMEOUT_MS = 30 * 60 * 1000;

export async function enqueueBackup(options: {
  type: BackupType;
  initiatedById?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  assertBackupAllowed();
  const running = await anyHeavyJobRunning();
  if (running.busy) {
    throw new AppError({
      code: running.backup ? ErrorCodes.BACKUP_IN_PROGRESS : ErrorCodes.JOB_CONFLICT,
    });
  }

  const last = await prisma.backup.aggregate({ _max: { backupNumber: true } });
  const backupNumber = (last._max.backupNumber ?? 0) + 1;
  const backup = await prisma.backup.create({
    data: {
      backupNumber,
      type: options.type,
      status: JobStatus.PENDING,
      progressStage: BackupProgressStage.PREPARING,
      initiatedById: options.initiatedById ?? undefined,
    },
  });

  await audit({
    actorId: options.initiatedById,
    action: options.type === "MANUAL" ? AuditActions.BACKUP_MANUAL_STARTED : AuditActions.BACKUP_SCHEDULED_STARTED,
    resourceType: "Backup",
    resourceId: backup.id,
    result: "SUCCESS",
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    metadata: { backupNumber },
  });

  void runBackupJob(backup.id).catch(() => undefined);
  return backup;
}

export async function runBackupJob(backupId: string) {
  const log = childLogger({ jobId: backupId, job: "backup" });
  const env = getEnv();
  let tempDump: string | undefined;
  let lock: Awaited<ReturnType<typeof acquireJobLock>> | undefined;
  const startedAt = new Date();

  try {
    lock = await acquireJobLock("backup", backupId);
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: JobStatus.RUNNING,
        progressStage: BackupProgressStage.PREPARING,
        startedAt,
      },
    });

    const disk = await getDiskUsage();
    if (disk.critical || disk.availableBytes < 200 * 1024 * 1024) {
      throw new AppError({ code: ErrorCodes.DISK_FULL });
    }

    await ensureBackupDir();
    const source = await getSourceHealth();
    if (!source.connected) {
      throw new AppError({ code: ErrorCodes.SOURCE_DB_UNREACHABLE });
    }
    if (source.incompatible) {
      throw new AppError({ code: ErrorCodes.PG_VERSION_INCOMPATIBLE });
    }

    const connection = parsePostgresUrl(env.SOURCE_DATABASE_URL!);
    const pgEnv = toPgEnv(connection);
    tempDump = createTempDumpPath(`weps-dump-${backupId}`);

    await prisma.backup.update({
      where: { id: backupId },
      data: {
        progressStage: BackupProgressStage.DUMPING,
        postgresServerVersion: source.serverVersion,
        pgDumpVersion: source.clientVersion,
      },
    });

    const dumpResult = await postgresCommandRunner.run({
      command: "pg_dump",
      args: ["--format=custom", "--compress=9", "--no-owner", "--no-privileges", `--file=${tempDump}`],
      env: pgEnv,
      timeoutMs: DUMP_TIMEOUT_MS,
    });
    if (dumpResult.code !== 0) {
      throw new AppError({
        code: ErrorCodes.PG_DUMP_FAILED,
        message: dumpResult.stderr || "pg_dump exited non-zero",
      });
    }

    const dumpStat = await stat(tempDump);
    if (!dumpStat.size) {
      throw new AppError({ code: ErrorCodes.BACKUP_FILE_EMPTY });
    }

    await prisma.backup.update({
      where: { id: backupId },
      data: {
        progressStage: BackupProgressStage.VALIDATING,
        originalDumpSizeBytes: BigInt(dumpStat.size),
      },
    });

    const listResult = await postgresCommandRunner.run({
      command: "pg_restore",
      args: ["--list", tempDump],
      timeoutMs: 5 * 60 * 1000,
    });
    if (listResult.code !== 0 || !listResult.stdout.trim()) {
      throw new AppError({
        code: ErrorCodes.INTEGRITY_CHECK_FAILED,
        message: listResult.stderr || "pg_restore --list failed",
      });
    }

    const sha256 = await sha256File(tempDump);

    await prisma.backup.update({
      where: { id: backupId },
      data: {
        progressStage: BackupProgressStage.ENCRYPTING,
        sha256,
        integrityStatus: "VALID",
      },
    });

    const fileName = generateBackupFileName();
    const storagePath = resolveBackupPath(fileName);
    const key = parseEncryptionKey(env.BACKUP_ENCRYPTION_KEY);
    const { ivHex, authTagHex } = await encryptFileAes256Gcm({
      inputPath: tempDump,
      outputPath: storagePath,
      key,
    });
    const verified = await verifyEncryptedFileChecksum({
      encryptedPath: storagePath,
      key,
      ivHex,
      authTagHex,
      expectedSha256: sha256,
    });
    if (!verified) {
      throw new AppError({ code: ErrorCodes.CHECKSUM_MISMATCH });
    }
    await setRestrictiveFileMode(storagePath);

    await prisma.backup.update({
      where: { id: backupId },
      data: { progressStage: BackupProgressStage.SAVING },
    });

    const encStat = await stat(storagePath);
    if (!encStat.size) {
      throw new AppError({ code: ErrorCodes.DISK_WRITE_FAILED });
    }

    await prisma.backup.update({
      where: { id: backupId },
      data: { progressStage: BackupProgressStage.FINALIZING },
    });

    const completedAt = new Date();
    const updated = await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: JobStatus.SUCCESS,
        progressStage: BackupProgressStage.FINALIZING,
        fileName,
        storagePath: fileName,
        encryptedSizeBytes: BigInt(encStat.size),
        encryptionIv: ivHex,
        encryptionAuthTag: authTagHex,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });

    const retention = await applyRetention(env.BACKUP_RETENTION_COUNT);
    if (retention.warnings.length > 0) {
      await audit({
        action: AuditActions.RETENTION_WARNING,
        resourceType: "Backup",
        resourceId: backupId,
        result: "WARNING",
        metadata: { warnings: retention.warnings },
      });
    }

    await audit({
      actorId: updated.initiatedById,
      action: AuditActions.BACKUP_SUCCESS,
      resourceType: "Backup",
      resourceId: backupId,
      result: "SUCCESS",
      metadata: {
        backupNumber: updated.backupNumber,
        encryptedSizeBytes: Number(encStat.size),
      },
    });

    if (updated.type === "SCHEDULED") {
      const settings = await getSystemSettings();
      const nextScheduledBackupAt = computeNextScheduledBackupAt({
        now: new Date(),
        localTime: settings.backupLocalTime,
        timezone: settings.timezone,
        intervalDays: settings.backupIntervalDays,
        lastScheduledAt: settings.nextScheduledBackupAt,
      });
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { nextScheduledBackupAt },
      });
    }

    await notifyBackupResult({ backup: updated, success: true });
    log.info({ backupNumber: updated.backupNumber }, "Backup completed");
  } catch (error) {
    const userError = toUserError(error);
    log.error({ err: error, code: userError.code, referenceId: userError.referenceId }, "Backup failed");
    const failed = await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        errorCode: userError.code,
        errorMessage: userError.message,
        errorReferenceId: userError.referenceId,
        integrityStatus: userError.code === ErrorCodes.INTEGRITY_CHECK_FAILED ? "INVALID" : undefined,
      },
    });
    await audit({
      actorId: failed.initiatedById,
      action: AuditActions.BACKUP_FAILED,
      resourceType: "Backup",
      resourceId: backupId,
      result: "FAILURE",
      metadata: { code: userError.code, referenceId: userError.referenceId },
    });
    await notifyBackupResult({ backup: failed, success: false });
  } finally {
    await safeUnlink(tempDump);
    await lock?.release();
  }
}
