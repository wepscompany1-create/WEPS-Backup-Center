import "server-only";

import { stat } from "node:fs/promises";
import { DateTime } from "luxon";
import {
  ProductionRestoreEventLevel,
  ProductionRestoreMode,
  ProductionRestoreStage,
  ProductionRestoreStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { acquireJobLock } from "@/lib/db/locks";
import { getSystemSettings } from "@/lib/db/settings";
import { getEnv } from "@/lib/config/env";
import { parseEncryptionKey } from "@/lib/crypto/key";
import { decryptFileAes256Gcm } from "@/lib/crypto/aes";
import { checksumsMatch, sha256File } from "@/lib/crypto/checksum";
import { postgresCommandRunner } from "@/lib/postgres/command-runner";
import {
  createProductionCandidateName,
  createProductionPreviousName,
  isSafeProductionCandidateName,
  isSafeProductionPreviousName,
  parsePostgresUrl,
  quoteIdent,
  toPgEnv,
  type PostgresConnection,
} from "@/lib/postgres/url";
import { createTempDumpPath, resolveBackupPath, safeUnlink } from "@/lib/storage/paths";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { audit, AuditActions } from "@/lib/audit";
import { childLogger } from "@/lib/logger";
import { notifyProductionRestore } from "@/features/notifications/email-service";
import {
  classifyRenameFailure,
  isCutoverEligibleStatus,
  shouldMarkExternalCutover,
} from "@/features/restore/production-restore-policy";

export { productionRestoreActions } from "@/features/restore/production-restore-policy";

const RESTORE_TIMEOUT_MS = 30 * 60 * 1000;

type RequestContext = {
  actorId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function assertProductionRestoreWindow(now = new Date()) {
  const settings = await getSystemSettings();
  if (!settings.productionRestoreMaintenanceEnabled) return settings;
  const local = DateTime.fromJSDate(now).setZone(settings.timezone);
  if (!local.isValid) throw new AppError({ code: ErrorCodes.CONFIGURATION_ERROR });
  const current = local.hour * 60 + local.minute;
  const start = minutes(settings.productionRestoreMaintenanceStart);
  const end = minutes(settings.productionRestoreMaintenanceEnd);
  const allowed = start <= end ? current >= start && current <= end : current >= start || current <= end;
  if (!allowed) throw new AppError({ code: ErrorCodes.OUTSIDE_MAINTENANCE_WINDOW });
  return settings;
}

export async function enqueueProductionRestore(options: RequestContext & {
  backupId: string;
  backupNumber: number;
  mode: ProductionRestoreMode;
}) {
  await assertProductionRestoreWindow();
  const backup = await prisma.backup.findUnique({ where: { id: options.backupId } });
  if (
    !backup ||
    backup.deletedAt ||
    backup.backupNumber !== options.backupNumber ||
    backup.status !== "SUCCESS" ||
    backup.integrityStatus !== "VALID" ||
    !backup.fileName ||
    !backup.sha256 ||
    !backup.encryptionIv ||
    !backup.encryptionAuthTag
  ) {
    throw new AppError({ code: ErrorCodes.PRODUCTION_RESTORE_NOT_ELIGIBLE });
  }
  await stat(resolveBackupPath(backup.fileName)).catch(() => {
    throw new AppError({ code: ErrorCodes.BACKUP_FILE_MISSING });
  });
  const requiredRestoreTest = await prisma.restoreTest.findFirst({
    where: {
      backupId: backup.id,
      status: "SUCCESS",
      integrityVerified: true,
      validationCompleted: true,
      tempDatabaseDropped: true,
    },
    orderBy: { completedAt: "desc" },
  });
  if (!requiredRestoreTest) throw new AppError({ code: ErrorCodes.RESTORE_TEST_REQUIRED });

  const source = parsePostgresUrl(getEnv().SOURCE_DATABASE_URL!);
  const candidateDatabaseName = createProductionCandidateName();
  if (!isSafeProductionCandidateName(candidateDatabaseName)) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }
  const now = new Date();
  const restore = await prisma.productionRestore.create({
    data: {
      backupId: backup.id,
      requiredRestoreTestId: requiredRestoreTest.id,
      initiatedById: options.actorId,
      mode: options.mode,
      status: ProductionRestoreStatus.PENDING,
      progressStage: ProductionRestoreStage.PREPARING,
      originalDatabaseName: source.database,
      candidateDatabaseName,
      overwriteAcknowledgedAt: now,
      initialConfirmationAt: now,
      passwordReauthAt: now,
    },
  });
  let lock: Awaited<ReturnType<typeof acquireJobLock>>;
  try {
    lock = await acquireJobLock("production_restore", restore.id);
  } catch (error) {
    await prisma.productionRestore.delete({ where: { id: restore.id } });
    throw error;
  }
  await audit({
    actorId: options.actorId,
    action: AuditActions.PRODUCTION_RESTORE_STARTED,
    resourceType: "ProductionRestore",
    resourceId: restore.id,
    result: "SUCCESS",
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    metadata: { backupId: backup.id, backupNumber: backup.backupNumber, mode: options.mode },
  });
  void runProductionRestoreJob(restore.id, lock).catch(() => undefined);
  return restore;
}

export async function runProductionRestoreJob(
  restoreId: string,
  reservedLock?: Awaited<ReturnType<typeof acquireJobLock>>,
) {
  const log = childLogger({ jobId: restoreId, job: "production-restore" });
  const startedAt = new Date();
  let lock = reservedLock;
  let tempDump: string | undefined;
  let candidateCreated = false;
  try {
    lock ??= await acquireJobLock("production_restore", restoreId);
    const restore = await prisma.productionRestore.update({
      where: { id: restoreId },
      data: { status: "RUNNING", startedAt, progressStage: "PREPARING" },
      include: { backup: true },
    });
    const env = getEnv();
    const source = parsePostgresUrl(env.SOURCE_DATABASE_URL!);
    assertRecordedNames(restore, source);
    tempDump = createTempDumpPath(`weps-prod-restore-${restore.id}`);
    await stage(restore.id, "DECRYPTING", "DECRYPTING_STARTED");
    await decryptFileAes256Gcm({
      inputPath: resolveBackupPath(restore.backup.fileName!),
      outputPath: tempDump,
      key: parseEncryptionKey(env.BACKUP_ENCRYPTION_KEY),
      ivHex: restore.backup.encryptionIv!,
      authTagHex: restore.backup.encryptionAuthTag!,
    });
    await stage(restore.id, "VERIFYING", "VERIFYING_STARTED");
    const actual = await sha256File(tempDump);
    if (!checksumsMatch(restore.backup.sha256!, actual)) {
      throw new AppError({ code: ErrorCodes.CHECKSUM_MISMATCH });
    }
    const list = await postgresCommandRunner.run({
      command: "pg_restore",
      args: ["--list", tempDump],
      timeoutMs: 5 * 60 * 1000,
    });
    if (list.code !== 0 || !list.stdout.trim()) {
      throw new AppError({ code: ErrorCodes.INTEGRITY_CHECK_FAILED });
    }
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: { integrityVerified: true },
    });
    await stage(restore.id, "CREATING_CANDIDATE", "CANDIDATE_CREATING", {
      candidateDatabaseName: restore.candidateDatabaseName,
    });
    const maintenance = maintenanceConnection(source);
    const create = await runSql(
      maintenance,
      `CREATE DATABASE ${quoteIdent(restore.candidateDatabaseName)};`,
      60_000,
    );
    if (create.code !== 0) {
      throw new AppError({ code: ErrorCodes.TEMP_DB_CREATE_FAILED, message: create.stderr });
    }
    candidateCreated = true;
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: { candidateCreated: true },
    });
    await stage(restore.id, "RESTORING", "CANDIDATE_RESTORING");
    const candidate = { ...source, database: restore.candidateDatabaseName };
    const restored = await postgresCommandRunner.run({
      command: "pg_restore",
      args: [
        "--no-owner",
        "--no-privileges",
        `--dbname=${restore.candidateDatabaseName}`,
        tempDump,
      ],
      env: toPgEnv(candidate),
      timeoutMs: RESTORE_TIMEOUT_MS,
    });
    if (restored.code !== 0) {
      throw new AppError({ code: ErrorCodes.PG_RESTORE_FAILED, message: restored.stderr });
    }
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: { restoreCompleted: true },
    });
    await stage(restore.id, "VALIDATING", "CANDIDATE_VALIDATING");
    const validation = await validateCandidate(candidate);
    const readyAt = new Date();
    const ready = await prisma.productionRestore.update({
      where: { id: restore.id },
      data: {
        status: "AWAITING_CUTOVER",
        progressStage: "AWAITING_CUTOVER",
        validationCompleted: true,
        tableCount: validation.tableCount,
        validationSummary: validation.summary,
        candidateReadyAt: readyAt,
        durationMs: readyAt.getTime() - startedAt.getTime(),
      },
    });
    await event(restore.id, "AWAITING_CUTOVER", "INFO", "CANDIDATE_READY", {
      candidateDatabaseName: restore.candidateDatabaseName,
      tableCount: validation.tableCount,
    });
    await audit({
      actorId: ready.initiatedById,
      action: AuditActions.PRODUCTION_RESTORE_READY,
      resourceType: "ProductionRestore",
      resourceId: restore.id,
      result: "SUCCESS",
      metadata: { tableCount: validation.tableCount },
    });
    await notifyProductionRestore({ restore: ready, kind: "ready" });
  } catch (error) {
    const userError = toUserError(error);
    let cleanupFailed = false;
    if (candidateCreated) {
      try {
        await dropCandidate(restoreId);
      } catch {
        cleanupFailed = true;
      }
    }
    const failed = await prisma.productionRestore.update({
      where: { id: restoreId },
      data: {
        status: "FAILED",
        progressStage: cleanupFailed ? "CLEANING_FAILED" : undefined,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        errorCode: cleanupFailed ? ErrorCodes.CANDIDATE_CLEANUP_FAILED : userError.code,
        errorMessage: cleanupFailed
          ? new AppError({ code: ErrorCodes.CANDIDATE_CLEANUP_FAILED }).userMessage
          : userError.message,
        errorReferenceId: userError.referenceId,
      },
    });
    await event(
      restoreId,
      cleanupFailed ? "CLEANING_FAILED" : failed.progressStage,
      cleanupFailed ? "CRITICAL" : "WARNING",
      "PRODUCTION_RESTORE_FAILED",
      { code: failed.errorCode, referenceId: failed.errorReferenceId },
    );
    await audit({
      actorId: failed.initiatedById,
      action: AuditActions.PRODUCTION_RESTORE_FAILED,
      resourceType: "ProductionRestore",
      resourceId: restoreId,
      result: "FAILURE",
      metadata: { code: failed.errorCode, referenceId: failed.errorReferenceId },
    });
    await notifyProductionRestore({ restore: failed, kind: cleanupFailed ? "critical" : "failure" });
    log.error({ code: failed.errorCode, referenceId: failed.errorReferenceId }, "Production restore failed");
  } finally {
    await safeUnlink(tempDump);
    await lock?.release();
  }
}

export async function cutoverProductionRestore(options: RequestContext & {
  restoreId: string;
  backupNumber: number;
}) {
  const settings = await assertProductionRestoreWindow();
  const restore = await prisma.productionRestore.findUnique({
    where: { id: options.restoreId },
    include: { backup: true },
  });
  if (!restore) throw new AppError({ code: ErrorCodes.PRODUCTION_RESTORE_NOT_FOUND });
  if (
    !isCutoverEligibleStatus(restore.status) ||
    !restore.validationCompleted ||
    restore.backup.backupNumber !== options.backupNumber
  ) {
    throw new AppError({ code: ErrorCodes.INVALID_RESTORE_STATE });
  }
  const source = parsePostgresUrl(getEnv().SOURCE_DATABASE_URL!);
  assertRecordedNames(restore, source);
  const previousDatabaseName = createProductionPreviousName();
  const lock = await acquireJobLock("production_restore", restore.id);
  const startedAt = new Date();
  try {
    const maintenance = maintenanceConnection(source);
    const names = await existingDatabases(maintenance, [
      restore.originalDatabaseName,
      restore.candidateDatabaseName,
      previousDatabaseName,
    ]);
    if (!names.has(restore.originalDatabaseName) || !names.has(restore.candidateDatabaseName) || names.has(previousDatabaseName)) {
      throw new AppError({ code: ErrorCodes.INVALID_RESTORE_STATE });
    }
    const active = await activeConnections(maintenance, restore.originalDatabaseName);
    if (active > 0) {
      await recordRetryableCutoverFailure(restore.id);
      throw new AppError({ code: ErrorCodes.CUTOVER_ACTIVE_CONNECTIONS });
    }
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: {
        status: "RUNNING",
        cutoverById: options.actorId,
        cutoverRequestedAt: startedAt,
        cutoverStartedAt: startedAt,
        cutoverConfirmationAt: startedAt,
        previousDatabaseName,
        progressStage: "CUTOVER_RENAMING_ORIGINAL",
        originalRenameStartedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        errorReferenceId: null,
      },
    });
    await event(restore.id, "CUTOVER_RENAMING_ORIGINAL", "WARNING", "CUTOVER_RENAME_ORIGINAL");
    const first = await renameDatabase(
      maintenance,
      restore.originalDatabaseName,
      previousDatabaseName,
    );
    if (first.code !== 0) {
      const code = classifyRenameFailure(first.stderr);
      if (shouldMarkExternalCutover(code)) {
        await markExternalCutover(restore.id);
      } else {
        await recordRetryableCutoverFailure(restore.id);
      }
      throw new AppError({ code });
    }
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: {
        originalRenamedAt: new Date(),
        candidateRenameStartedAt: new Date(),
        progressStage: "CUTOVER_RENAMING_CANDIDATE",
      },
    });
    const second = await renameDatabase(
      maintenance,
      restore.candidateDatabaseName,
      restore.originalDatabaseName,
    );
    if (second.code !== 0) {
      await prisma.productionRestore.update({
        where: { id: restore.id },
        data: {
          progressStage: "COMPENSATING_RENAME",
          compensationAttemptedAt: new Date(),
        },
      });
      const currentNames = await existingDatabases(maintenance, [
        restore.originalDatabaseName,
        previousDatabaseName,
      ]);
      const canCompensate =
        !currentNames.has(restore.originalDatabaseName) && currentNames.has(previousDatabaseName);
      const compensation = canCompensate
        ? await renameDatabase(maintenance, previousDatabaseName, restore.originalDatabaseName)
        : { code: 1, stderr: "unsafe compensation state", stdout: "" };
      if (compensation.code === 0) {
        const failed = await prisma.productionRestore.update({
          where: { id: restore.id },
          data: {
            status: "FAILED",
            compensationSucceededAt: new Date(),
            completedAt: new Date(),
            errorCode: ErrorCodes.CUTOVER_PARTIAL_FAILURE,
            errorMessage: new AppError({ code: ErrorCodes.CUTOVER_PARTIAL_FAILURE }).userMessage,
          },
        });
        await event(restore.id, "COMPENSATING_RENAME", "CRITICAL", "CUTOVER_COMPENSATED");
        await notifyProductionRestore({ restore: failed, kind: "critical" });
        return failed;
      }
      const critical = await prisma.productionRestore.update({
        where: { id: restore.id },
        data: {
          status: "INTERRUPTED",
          progressStage: "ROLLBACK_REQUIRED",
          criticalState: "ORIGINAL_RENAMED_CANDIDATE_RENAME_FAILED",
          completedAt: new Date(),
          errorCode: ErrorCodes.CUTOVER_PARTIAL_FAILURE,
          errorMessage: new AppError({ code: ErrorCodes.CUTOVER_PARTIAL_FAILURE }).userMessage,
        },
      });
      await event(restore.id, "ROLLBACK_REQUIRED", "CRITICAL", "ROLLBACK_REQUIRED", {
        originalDatabaseName: restore.originalDatabaseName,
        candidateDatabaseName: restore.candidateDatabaseName,
        previousDatabaseName,
      });
      await notifyProductionRestore({ restore: critical, kind: "critical" });
      return critical;
    }
    const completedAt = new Date();
    const successful = await prisma.productionRestore.update({
      where: { id: restore.id },
      data: {
        status: "SUCCESS",
        progressStage: "ROLLBACK_AVAILABLE",
        cutoverCompleted: true,
        cutoverCompletedAt: completedAt,
        completedAt,
        errorCode: null,
        errorMessage: null,
        errorReferenceId: null,
        durationMs: completedAt.getTime() - (restore.startedAt ?? startedAt).getTime(),
        rollbackAvailableUntil: new Date(
          completedAt.getTime() + settings.productionRestoreRollbackRetentionHours * 3_600_000,
        ),
      },
    });
    await event(restore.id, "ROLLBACK_AVAILABLE", "INFO", "CUTOVER_COMPLETED", {
      previousDatabaseName,
    });
    await audit({
      actorId: options.actorId,
      action: AuditActions.PRODUCTION_RESTORE_CUTOVER_SUCCESS,
      resourceType: "ProductionRestore",
      resourceId: restore.id,
      result: "SUCCESS",
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: { backupNumber: restore.backup.backupNumber },
    });
    await notifyProductionRestore({ restore: successful, kind: "success" });
    return successful;
  } finally {
    await lock.release();
  }
}

export async function dropPreviousProductionDatabase(options: RequestContext & {
  restoreId: string;
  backupNumber: number;
}) {
  await assertProductionRestoreWindow();
  const restore = await prisma.productionRestore.findUnique({
    where: { id: options.restoreId },
    include: { backup: true },
  });
  if (!restore) throw new AppError({ code: ErrorCodes.PRODUCTION_RESTORE_NOT_FOUND });
  if (
    restore.status !== "SUCCESS" ||
    !restore.cutoverCompleted ||
    !restore.previousDatabaseName ||
    restore.previousDroppedAt ||
    restore.backup.backupNumber !== options.backupNumber
  ) {
    throw new AppError({ code: ErrorCodes.INVALID_RESTORE_STATE });
  }
  if (!restore.rollbackAvailableUntil || restore.rollbackAvailableUntil > new Date()) {
    throw new AppError({ code: ErrorCodes.PREVIOUS_RETENTION_ACTIVE });
  }
  const source = parsePostgresUrl(getEnv().SOURCE_DATABASE_URL!);
  if (
    !isSafeProductionPreviousName(restore.previousDatabaseName) ||
    restore.previousDatabaseName === source.database ||
    restore.previousDatabaseName === parsePostgresUrl(getEnv().DATABASE_URL!).database
  ) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }
  const lock = await acquireJobLock("production_restore", restore.id);
  try {
    await prisma.productionRestore.update({
      where: { id: restore.id },
      data: {
        progressStage: "DROPPING_PREVIOUS",
        previousDroppedById: options.actorId,
        dropPreviousConfirmationAt: new Date(),
      },
    });
    const maintenance = maintenanceConnection(source);
    await runSql(
      maintenance,
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${literal(restore.previousDatabaseName)} AND pid <> pg_backend_pid();`,
      30_000,
    );
    const dropped = await runSql(
      maintenance,
      `DROP DATABASE IF EXISTS ${quoteIdent(restore.previousDatabaseName)};`,
      60_000,
    );
    if (dropped.code !== 0) {
      throw new AppError({ code: ErrorCodes.TEMP_DB_DROP_FAILED, message: dropped.stderr });
    }
    const updated = await prisma.productionRestore.update({
      where: { id: restore.id },
      data: { previousDroppedAt: new Date(), progressStage: "COMPLETED" },
    });
    await event(restore.id, "COMPLETED", "WARNING", "PREVIOUS_DATABASE_DROPPED");
    await audit({
      actorId: options.actorId,
      action: AuditActions.PRODUCTION_PREVIOUS_DROPPED,
      resourceType: "ProductionRestore",
      resourceId: restore.id,
      result: "SUCCESS",
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
    await notifyProductionRestore({ restore: updated, kind: "previous-dropped" });
    return updated;
  } finally {
    await lock.release();
  }
}


async function stage(
  restoreId: string,
  progressStage: ProductionRestoreStage,
  messageCode: string,
  safeMetadata?: Prisma.InputJsonValue,
) {
  await prisma.productionRestore.update({ where: { id: restoreId }, data: { progressStage } });
  await event(restoreId, progressStage, "INFO", messageCode, safeMetadata);
}

async function event(
  productionRestoreId: string,
  stageName: ProductionRestoreStage,
  level: ProductionRestoreEventLevel,
  messageCode: string,
  safeMetadata?: Prisma.InputJsonValue,
) {
  await prisma.productionRestoreEvent.create({
    data: { productionRestoreId, stage: stageName, level, messageCode, safeMetadata },
  });
}

function maintenanceConnection(source: PostgresConnection) {
  const maintenanceDatabase = getEnv().SOURCE_MAINTENANCE_DATABASE;
  const appDatabase = getEnv().DATABASE_URL
    ? parsePostgresUrl(getEnv().DATABASE_URL!).database
    : null;
  if (maintenanceDatabase === source.database || maintenanceDatabase === appDatabase) {
    throw new AppError({
      code: ErrorCodes.CONFIGURATION_ERROR,
      message: "قاعدة الصيانة يجب أن تكون منفصلة عن قاعدة الإنتاج وقاعدة مركز النسخ.",
    });
  }
  return { ...source, database: maintenanceDatabase };
}

function assertRecordedNames(
  restore: { originalDatabaseName: string; candidateDatabaseName: string },
  source: PostgresConnection,
) {
  const appDb = getEnv().DATABASE_URL ? parsePostgresUrl(getEnv().DATABASE_URL!).database : null;
  if (
    restore.originalDatabaseName !== source.database ||
    !isSafeProductionCandidateName(restore.candidateDatabaseName) ||
    restore.candidateDatabaseName === source.database ||
    restore.candidateDatabaseName === appDb
  ) {
    throw new AppError({ code: ErrorCodes.UNSAFE_DATABASE_NAME });
  }
}

async function validateCandidate(connection: PostgresConnection) {
  const tables = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-Atqc",
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema');",
    ],
    env: toPgEnv(connection),
    timeoutMs: 15_000,
  });
  const ping = await postgresCommandRunner.run({
    command: "psql",
    args: ["-Atqc", "SELECT 1;"],
    env: toPgEnv(connection),
    timeoutMs: 15_000,
  });
  if (tables.code !== 0 || ping.code !== 0 || ping.stdout.trim() !== "1") {
    throw new AppError({ code: ErrorCodes.RESTORE_VALIDATION_FAILED });
  }
  const tableCount = Number(tables.stdout.trim() || "0");
  return { tableCount, summary: { tableCount, ping: true } };
}

async function dropCandidate(restoreId: string) {
  const restore = await prisma.productionRestore.findUnique({ where: { id: restoreId } });
  if (!restore) throw new AppError({ code: ErrorCodes.PRODUCTION_RESTORE_NOT_FOUND });
  const source = parsePostgresUrl(getEnv().SOURCE_DATABASE_URL!);
  assertRecordedNames(restore, source);
  const maintenance = maintenanceConnection(source);
  await runSql(
    maintenance,
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${literal(restore.candidateDatabaseName)} AND pid <> pg_backend_pid();`,
    30_000,
  );
  const result = await runSql(
    maintenance,
    `DROP DATABASE IF EXISTS ${quoteIdent(restore.candidateDatabaseName)};`,
    60_000,
  );
  if (result.code !== 0) {
    throw new AppError({ code: ErrorCodes.CANDIDATE_CLEANUP_FAILED });
  }
}

async function runSql(connection: PostgresConnection, sql: string, timeoutMs: number) {
  return postgresCommandRunner.run({
    command: "psql",
    args: ["-v", "ON_ERROR_STOP=1", "-c", sql],
    env: toPgEnv(connection),
    timeoutMs,
  });
}

async function renameDatabase(connection: PostgresConnection, from: string, to: string) {
  return runSql(
    connection,
    `ALTER DATABASE ${quoteIdent(from)} RENAME TO ${quoteIdent(to)};`,
    60_000,
  );
}

async function existingDatabases(connection: PostgresConnection, names: string[]) {
  const result = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-Atqc",
      `SELECT datname FROM pg_database WHERE datname IN (${names.map(literal).join(",")});`,
    ],
    env: toPgEnv(connection),
    timeoutMs: 20_000,
  });
  if (result.code !== 0) throw new AppError({ code: ErrorCodes.SOURCE_DB_UNREACHABLE });
  return new Set(result.stdout.split("\n").map((value) => value.trim()).filter(Boolean));
}

async function activeConnections(connection: PostgresConnection, databaseName: string) {
  const result = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-Atqc",
      `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = ${literal(databaseName)} AND pid <> pg_backend_pid();`,
    ],
    env: toPgEnv(connection),
    timeoutMs: 20_000,
  });
  if (result.code !== 0) throw new AppError({ code: ErrorCodes.SOURCE_DB_UNREACHABLE });
  return Number(result.stdout.trim() || "0");
}

async function recordRetryableCutoverFailure(restoreId: string) {
  const appError = new AppError({ code: ErrorCodes.CUTOVER_ACTIVE_CONNECTIONS });
  await prisma.productionRestore.update({
    where: { id: restoreId },
    data: {
      status: "AWAITING_CUTOVER",
      progressStage: "AWAITING_CUTOVER",
      previousDatabaseName: null,
      errorCode: appError.code,
      errorMessage: appError.userMessage,
      errorReferenceId: appError.referenceId,
    },
  });
  await event(restoreId, "AWAITING_CUTOVER", "WARNING", "CUTOVER_ACTIVE_CONNECTIONS", {
    code: appError.code,
    referenceId: appError.referenceId,
  });
}

async function markExternalCutover(restoreId: string) {
  const appError = new AppError({ code: ErrorCodes.CUTOVER_PERMISSION_DENIED });
  await prisma.productionRestore.update({
    where: { id: restoreId },
    data: {
      status: "AWAITING_EXTERNAL_CUTOVER",
      progressStage: "AWAITING_EXTERNAL_CUTOVER",
      errorCode: appError.code,
      errorMessage: appError.userMessage,
      errorReferenceId: appError.referenceId,
    },
  });
  await event(restoreId, "AWAITING_EXTERNAL_CUTOVER", "WARNING", "EXTERNAL_CUTOVER_REQUIRED", {
    code: appError.code,
    referenceId: appError.referenceId,
  });
}

function literal(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new AppError({ code: ErrorCodes.CONFIGURATION_ERROR });
  }
  return hour * 60 + minute;
}
