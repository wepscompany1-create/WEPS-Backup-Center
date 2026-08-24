import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { AppError, ErrorCodes } from "@/lib/errors";

const STALE_LOCK_MS = 3 * 60 * 60 * 1000;

export type LockName = "backup" | "restore";

export async function acquireJobLock(name: LockName, holder = randomBytes(8).toString("hex")) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

  const result = await prisma.$executeRaw`
    UPDATE "JobLock"
    SET "holder" = ${holder}, "acquiredAt" = ${now}
    WHERE "name" = ${name}
      AND (
        "holder" IS NULL
        OR "acquiredAt" IS NULL
        OR "acquiredAt" < ${staleBefore}
      )
  `;

  if (result !== 1) {
    throw new AppError({
      code: name === "backup" ? ErrorCodes.BACKUP_IN_PROGRESS : ErrorCodes.RESTORE_IN_PROGRESS,
    });
  }

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
  const [backup, restore] = await Promise.all([isLockHeld("backup"), isLockHeld("restore")]);
  return { backup, restore, busy: backup || restore };
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
