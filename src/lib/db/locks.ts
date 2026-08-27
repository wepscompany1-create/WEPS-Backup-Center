import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ErrorCodes } from "@/lib/errors";

const STALE_LOCK_MS = 3 * 60 * 60 * 1000;

export type LockName = "backup" | "restore" | "production_restore";

const HEAVY_LOCK_NAMES: LockName[] = ["backup", "restore", "production_restore"];

export async function acquireJobLock(name: LockName, holder = randomBytes(8).toString("hex")) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ name: string; holder: string | null; acquiredAt: Date | null }>>`
      SELECT "name", "holder", "acquiredAt"
      FROM "JobLock"
      WHERE "name" IN ('backup', 'restore', 'production_restore')
      ORDER BY "name"
      FOR UPDATE
    `;
    const byName = new Map(rows.map((row) => [row.name, row]));
    if (HEAVY_LOCK_NAMES.some((lockName) => !byName.has(lockName))) {
      throw new AppError({ code: ErrorCodes.CONFIGURATION_ERROR });
    }
    const conflict = rows.find(
      (row) =>
        row.holder &&
        row.holder !== holder &&
        row.acquiredAt &&
        row.acquiredAt >= staleBefore,
    );
    if (conflict) {
      throw new AppError({
        code:
          conflict.name === "backup"
            ? ErrorCodes.BACKUP_IN_PROGRESS
            : conflict.name === "production_restore"
              ? ErrorCodes.PRODUCTION_RESTORE_IN_PROGRESS
              : ErrorCodes.RESTORE_IN_PROGRESS,
      });
    }
    await tx.jobLock.update({
      where: { name },
      data: { holder, acquiredAt: now },
    });
  }, { isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel });

  return {
    name,
    holder,
    async release() {
      await prisma.$executeRaw`
        UPDATE "JobLock"
        SET "holder" = NULL, "acquiredAt" = NULL
        WHERE "name" = ${name} AND "holder" = ${holder}
      `;
    },
  };
}

export async function isLockHeld(name: LockName) {
  const row = await prisma.jobLock.findUnique({ where: { name } });
  if (!row?.holder || !row.acquiredAt) return false;
  return Date.now() - row.acquiredAt.getTime() < STALE_LOCK_MS;
}

export async function anyHeavyJobRunning() {
  const [backup, restore, productionRestore] = await Promise.all([
    isLockHeld("backup"),
    isLockHeld("restore"),
    isLockHeld("production_restore"),
  ]);
  return {
    backup,
    restore,
    productionRestore,
    busy: backup || restore || productionRestore,
  };
}

const SCHEDULER_LOCK_CLASS = 872001;
const SCHEDULER_LOCK_OBJECT = 1;

export async function tryAcquireAdvisoryLock() {
  const rows = await prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
    `SELECT pg_try_advisory_lock(${SCHEDULER_LOCK_CLASS}::int, ${SCHEDULER_LOCK_OBJECT}::int) AS locked`,
  );
  return rows[0]?.locked === true;
}

export async function releaseAdvisoryLock() {
  await prisma.$queryRawUnsafe(
    `SELECT pg_advisory_unlock(${SCHEDULER_LOCK_CLASS}::int, ${SCHEDULER_LOCK_OBJECT}::int)`,
  );
}
