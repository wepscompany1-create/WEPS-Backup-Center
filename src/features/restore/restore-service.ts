import "server-only";

import { JobStatus, RestoreProgressStage } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { acquireJobLock } from "@/lib/db/locks";
import { getEnv } from "@/lib/config/env";
import { parseEncryptionKey } from "@/lib/crypto/key";
import { decryptFileAes256Gcm } from "@/lib/crypto/aes";
import { checksumsMatch, sha256File } from "@/lib/crypto/checksum";
import { postgresCommandRunner } from "@/lib/postgres/command-runner";
import {
  createTempDatabaseName,
  isSafeTempDatabaseName,
  parsePostgresUrl,
  quoteIdent,
  toPgEnv,
} from "@/lib/postgres/url";
import { createTempDumpPath, resolveBackupPath, safeUnlink } from "@/lib/storage/paths";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { childLogger } from "@/lib/logger";
import { audit, AuditActions } from "@/lib/audit";
import { notifyRestoreResult } from "@/features/notifications/email-service";

const RESTORE_TIMEOUT_MS = 30 * 60 * 1000;

export async function enqueueRestoreTest(options: {
  backupId: string;
  initiatedById?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const backup = await prisma.backup.findUnique({ where: { id: options.backupId } });
  if (
    !backup ||
    backup.deletedAt ||
    backup.status !== "SUCCESS" ||
    backup.integrityStatus !== "VALID"
  ) {
    throw new AppError({ code: ErrorCodes.BACKUP_NOT_FOUND });
  }
  if (!backup.fileName || !backup.sha256 || !backup.encryptionIv || !backup.encryptionAuthTag) {
    throw new AppError({ code: ErrorCodes.BACKUP_FILE_MISSING });
  }

  const test = await prisma.restoreTest.create({
    data: {
      backupId: backup.id,
      status: JobStatus.PENDING,
      progressStage: RestoreProgressStage.PREPARING,
      initiatedById: options.initiatedById ?? undefined,
    },
  });

  let reservedLock: Awaited<ReturnType<typeof acquireJobLock>>;
  try {
    reservedLock = await acquireJobLock("restore", test.id);
  } catch (error) {
    await prisma.restoreTest.delete({ where: { id: test.id } });
    throw error;
  }

  await audit({
    actorId: options.initiatedById,
    action: AuditActions.RESTORE_TEST_STARTED,
    resourceType: "RestoreTest",
    resourceId: test.id,
    result: "SUCCESS",
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    metadata: { backupId: backup.id },
  });

  void runRestoreTestJob(test.id, reservedLock).catch(() => undefined);
  return test;
}

export async function runRestoreTestJob(
  testId: string,
  reservedLock?: Awaited<ReturnType<typeof acquireJobLock>>,
) {
  const log = childLogger({ jobId: testId, job: "restore-test" });
  const env = getEnv();
  let tempDump: string | undefined;
  let lock: Awaited<ReturnType<typeof acquireJobLock>> | undefined;
  let tempDatabaseName: string | undefined;
  let databaseCreated = false;
  const startedAt = new Date();

  try {
    lock = reservedLock ?? (await acquireJobLock("restore", testId));
    const test = await prisma.restoreTest.update({
      where: { id: testId },
      data: {
        status: JobStatus.RUNNING,
        progressStage: RestoreProgressStage.PREPARING,
        startedAt,
      },
      include: { backup: true },
    });

    const backup = test.backup;
    if (!backup.fileName) {
      throw new AppError({ code: ErrorCodes.BACKUP_FILE_MISSING });
    }

    const encryptedPath = resolveBackupPath(backup.fileName);
    tempDump = createTempDumpPath(`weps-restore-${testId}`);

    await prisma.restoreTest.update({
      where: { id: testId },
      data: { progressStage: RestoreProgressStage.DECRYPTING },
    });

    await decryptFileAes256Gcm({
      inputPath: encryptedPath,
      outputPath: tempDump,
      key: parseEncryptionKey(env.BACKUP_ENCRYPTION_KEY),
      ivHex: backup.encryptionIv!,
      authTagHex: backup.encryptionAuthTag!,
    });

    await prisma.restoreTest.update({
      where: { id: testId },
      data: { progressStage: RestoreProgressStage.VERIFYING },
    });

    const actual = await sha256File(tempDump);
    if (!backup.sha256 || !checksumsMatch(backup.sha256, actual)) {
      throw new AppError({ code: ErrorCodes.CHECKSUM_MISMATCH });
    }

    const listResult = await postgresCommandRunner.run({
      command: "pg_restore",
      args: ["--list", tempDump],
      timeoutMs: 5 * 60 * 1000,
    });
    if (listResult.code !== 0) {
      throw new AppError({ code: ErrorCodes.INTEGRITY_CHECK_FAILED });
    }

    await prisma.restoreTest.update({
      where: { id: testId },
      data: { integrityVerified: true },
    });

    tempDatabaseName = createTempDatabaseName();
    if (!isSafeTempDatabaseName(tempDatabaseName)) {
      throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
    }

    const source = parsePostgresUrl(env.SOURCE_DATABASE_URL!);
    const appDb = env.DATABASE_URL ? parsePostgresUrl(env.DATABASE_URL) : null;
    if (tempDatabaseName === source.database || (appDb && tempDatabaseName === appDb.database)) {
      throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
    }

    await prisma.restoreTest.update({
      where: { id: testId },
      data: {
        tempDatabaseName,
        progressStage: RestoreProgressStage.CREATING_DATABASE,
      },
    });

    const adminEnv = toPgEnv(source);
    const createResult = await postgresCommandRunner.run({
      command: "psql",
      args: ["-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${quoteIdent(tempDatabaseName)};`],
      env: adminEnv,
      timeoutMs: 60_000,
    });
    if (createResult.code !== 0) {
      throw new AppError({
        code: ErrorCodes.TEMP_DB_CREATE_FAILED,
        message: createResult.stderr,
      });
    }
    databaseCreated = true;
    await prisma.restoreTest.update({
      where: { id: testId },
      data: { databaseCreated: true, progressStage: RestoreProgressStage.RESTORING },
    });

    const restoreEnv = toPgEnv({ ...source, database: tempDatabaseName });
    const restoreResult = await postgresCommandRunner.run({
      command: "pg_restore",
      args: ["--no-owner", "--no-privileges", `--dbname=${tempDatabaseName}`, tempDump],
      env: restoreEnv,
      timeoutMs: RESTORE_TIMEOUT_MS,
    });
    if (restoreResult.code !== 0) {
      throw new AppError({
        code: ErrorCodes.PG_RESTORE_FAILED,
        message: restoreResult.stderr,
      });
    }

    await prisma.restoreTest.update({
      where: { id: testId },
      data: { restoreCompleted: true, progressStage: RestoreProgressStage.VALIDATING },
    });

    const validation = await validateRestoredDatabase(restoreEnv);
    await prisma.restoreTest.update({
      where: { id: testId },
      data: {
        validationCompleted: true,
        tableCount: validation.tableCount,
        validationSummary: validation.summary,
        progressStage: RestoreProgressStage.CLEANING_UP,
      },
    });

    await dropTempDatabase({
      sourceEnv: adminEnv,
      sourceDbName: source.database,
      appDbName: appDb?.database,
      tempDatabaseName,
      testId,
    });

    const completedAt = new Date();
    const updated = await prisma.restoreTest.update({
      where: { id: testId },
      data: {
        status: JobStatus.SUCCESS,
        progressStage: RestoreProgressStage.COMPLETED,
        tempDatabaseDropped: true,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });

    await audit({
      actorId: updated.initiatedById,
      action: AuditActions.RESTORE_TEST_SUCCESS,
      resourceType: "RestoreTest",
      resourceId: testId,
      result: "SUCCESS",
      metadata: { tableCount: validation.tableCount },
    });
    await notifyRestoreResult({ test: updated, success: true });
    log.info({ tableCount: validation.tableCount }, "Restore test completed");
  } catch (error) {
    const userError = toUserError(error);
    log.error({ err: error, code: userError.code, referenceId: userError.referenceId }, "Restore test failed");

    if (databaseCreated && tempDatabaseName) {
      try {
        const source = parsePostgresUrl(getEnv().SOURCE_DATABASE_URL!);
        const appDb = getEnv().DATABASE_URL ? parsePostgresUrl(getEnv().DATABASE_URL!) : null;
        await dropTempDatabase({
          sourceEnv: toPgEnv(source),
          sourceDbName: source.database,
          appDbName: appDb?.database,
          tempDatabaseName,
          testId,
        });
        await prisma.restoreTest.update({
          where: { id: testId },
          data: { tempDatabaseDropped: true },
        });
      } catch (dropError) {
        log.error({ err: dropError, tempDatabaseName }, "Failed to drop temp restore database");
      }
    }

    const failed = await prisma.restoreTest.update({
      where: { id: testId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        errorCode: userError.code,
        errorMessage: userError.message,
        errorReferenceId: userError.referenceId,
      },
    });
    await audit({
      actorId: failed.initiatedById,
      action: AuditActions.RESTORE_TEST_FAILED,
      resourceType: "RestoreTest",
      resourceId: testId,
      result: "FAILURE",
      metadata: { code: userError.code, referenceId: userError.referenceId },
    });
    await notifyRestoreResult({ test: failed, success: false });
  } finally {
    await safeUnlink(tempDump);
    await lock?.release();
  }
}

async function validateRestoredDatabase(env: Record<string, string>) {
  const version = await postgresCommandRunner.run({
    command: "psql",
    args: ["-Atqc", "SELECT current_database();"],
    env,
    timeoutMs: 15_000,
  });
  if (version.code !== 0) {
    throw new AppError({ code: ErrorCodes.RESTORE_VALIDATION_FAILED });
  }

  const schemas = await postgresCommandRunner.run({
    command: "psql",
    args: ["-Atqc", "SELECT COUNT(*) FROM information_schema.schemata;"],
    env,
    timeoutMs: 15_000,
  });
  const tables = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-Atqc",
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema');",
    ],
    env,
    timeoutMs: 15_000,
  });
  const ping = await postgresCommandRunner.run({
    command: "psql",
    args: ["-Atqc", "SELECT 1;"],
    env,
    timeoutMs: 15_000,
  });

  if (schemas.code !== 0 || tables.code !== 0 || ping.code !== 0 || ping.stdout.trim() !== "1") {
    throw new AppError({ code: ErrorCodes.RESTORE_VALIDATION_FAILED });
  }

  const tableCount = Number(tables.stdout.trim() || "0");
  return {
    tableCount,
    summary: `schemas=${schemas.stdout.trim()} tables=${tableCount}`,
  };
}

async function dropTempDatabase(options: {
  sourceEnv: Record<string, string>;
  sourceDbName: string;
  appDbName?: string;
  tempDatabaseName: string;
  testId: string;
}) {
  const record = await prisma.restoreTest.findUnique({ where: { id: options.testId } });
  if (!record || record.tempDatabaseName !== options.tempDatabaseName) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }
  if (!isSafeTempDatabaseName(options.tempDatabaseName)) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }
  if (
    options.tempDatabaseName === options.sourceDbName ||
    options.tempDatabaseName === options.appDbName
  ) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }

  const terminate = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${literal(options.tempDatabaseName)};`,
    ],
    env: options.sourceEnv,
    timeoutMs: 30_000,
  });
  if (terminate.code !== 0) {
    throw new AppError({ code: ErrorCodes.TEMP_DB_DROP_FAILED, message: terminate.stderr });
  }

  const drop = await postgresCommandRunner.run({
    command: "psql",
    args: ["-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${quoteIdent(options.tempDatabaseName)};`],
    env: options.sourceEnv,
    timeoutMs: 60_000,
  });
  if (drop.code !== 0) {
    throw new AppError({ code: ErrorCodes.TEMP_DB_DROP_FAILED, message: drop.stderr });
  }
}

function literal(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
