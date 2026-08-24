import "server-only";

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { audit, AuditActions } from "@/lib/audit";
import { getBackupDir, safeUnlink } from "@/lib/storage/paths";
import { getSystemSettings } from "@/lib/db/settings";
import { computeNextScheduledBackupAt } from "@/lib/scheduler/next-run";
import { postgresCommandRunner } from "@/lib/postgres/command-runner";
import { isSafeTempDatabaseName, parsePostgresUrl, quoteIdent, toPgEnv } from "@/lib/postgres/url";
import { getEnv } from "@/lib/config/env";

export async function recoverInterruptedJobs() {
  const runningBackups = await prisma.backup.updateMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    data: {
      status: "INTERRUPTED",
      completedAt: new Date(),
      errorCode: "INTERNAL_ERROR",
      errorMessage: "انقطعت العملية بسبب إعادة تشغيل الخدمة.",
    },
  });
  const runningRestores = await prisma.restoreTest.updateMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    data: {
      status: "INTERRUPTED",
      completedAt: new Date(),
      errorCode: "INTERNAL_ERROR",
      errorMessage: "انقطعت العملية بسبب إعادة تشغيل الخدمة.",
    },
  });

  if (runningBackups.count > 0 || runningRestores.count > 0) {
    await audit({
      action: AuditActions.JOB_INTERRUPTED,
      result: "WARNING",
      metadata: {
        backups: runningBackups.count,
        restoreTests: runningRestores.count,
      },
    });
    logger.warn(
      { backups: runningBackups.count, restoreTests: runningRestores.count },
      "Marked interrupted jobs after startup",
    );
  }

  await prisma.jobLock.updateMany({
    data: { holder: null, acquiredAt: null },
  });
}

export async function cleanupTempFiles() {
  const dir = tmpdir();
  const entries = await readdir(dir).catch(() => []);
  const now = Date.now();
  for (const name of entries) {
    if (!name.startsWith("weps-dump-") && !name.startsWith("weps-restore-")) continue;
    const full = path.join(dir, name);
    try {
      const info = await stat(full);
      if (now - info.mtimeMs > 60 * 60 * 1000) {
        await safeUnlink(full);
      }
    } catch {
      // ignore
    }
  }
}

export async function cleanupOrphanRestoreDatabases() {
  const env = getEnv();
  if (!env.SOURCE_DATABASE_URL) return;

  const source = parsePostgresUrl(env.SOURCE_DATABASE_URL);
  const appDb = env.DATABASE_URL ? parsePostgresUrl(env.DATABASE_URL) : null;
  const listed = await postgresCommandRunner.run({
    command: "psql",
    args: [
      "-Atqc",
      "SELECT datname FROM pg_database WHERE datname LIKE 'restore_test_%';",
    ],
    env: toPgEnv(source),
    timeoutMs: 20_000,
  });
  if (listed.code !== 0) {
    logger.warn("Could not list restore_test databases during startup cleanup");
    return;
  }

  const names = listed.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const name of names) {
    if (!isSafeTempDatabaseName(name)) continue;
    if (name === source.database || (appDb && name === appDb.database)) continue;
    const record = await prisma.restoreTest.findFirst({
      where: { tempDatabaseName: name },
      orderBy: { createdAt: "desc" },
    });
    if (!record) continue;
    const drop = await postgresCommandRunner.run({
      command: "psql",
      args: ["-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${quoteIdent(name)};`],
      env: toPgEnv(source),
      timeoutMs: 60_000,
    });
    if (drop.code === 0) {
      await prisma.restoreTest.update({
        where: { id: record.id },
        data: { tempDatabaseDropped: true },
      });
      logger.info({ database: name }, "Dropped leftover restore test database");
    } else {
      logger.error({ database: name }, "Failed to drop leftover restore test database");
    }
  }
}

export async function ensureScheduleInitialized() {
  const settings = await getSystemSettings();
  if (settings.nextScheduledBackupAt) return settings;
  const nextScheduledBackupAt = computeNextScheduledBackupAt({
    now: new Date(),
    localTime: settings.backupLocalTime,
    timezone: settings.timezone,
    intervalDays: settings.backupIntervalDays,
  });
  return prisma.systemSettings.update({
    where: { id: settings.id },
    data: { nextScheduledBackupAt },
  });
}

export async function reconcileBackupFiles() {
  try {
    const dir = getBackupDir();
    const files = await readdir(dir).catch((): string[] => []);
    const records = await prisma.backup.findMany({
      where: { deletedAt: null, fileName: { not: null } },
      select: { id: true, fileName: true },
    });
    const recorded = new Set(
      records.map((row) => row.fileName).filter((name): name is string => Boolean(name)),
    );
    const missing = records.filter((row) => {
      if (!row.fileName) return false;
      return !files.includes(row.fileName);
    });
    const orphans = files.filter((name) => name.endsWith(".dump.enc") && !recorded.has(name));
    if (missing.length || orphans.length) {
      logger.warn({ missing: missing.length, orphans: orphans.length }, "Backup file reconciliation warnings");
    }
  } catch (error) {
    logger.warn({ err: error }, "Backup file reconciliation skipped");
  }
}
