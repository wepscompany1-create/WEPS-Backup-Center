import { prisma } from "@/lib/db/prisma";
import { computeNextScheduledBackupAt } from "@/lib/scheduler/next-run";
import { getEnv } from "@/lib/config/env";

export const SETTINGS_ID = "default";

export async function getSystemSettings() {
  const existing = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }

  const env = getEnv();
  const nextScheduledBackupAt = computeNextScheduledBackupAt({
    now: new Date(),
    localTime: "03:00",
    timezone: env.APP_TIMEZONE,
    intervalDays: 2,
  });

  return prisma.systemSettings.create({
    data: {
      id: SETTINGS_ID,
      scheduleEnabled: true,
      backupIntervalDays: 2,
      backupLocalTime: "03:00",
      timezone: env.APP_TIMEZONE,
      nextScheduledBackupAt,
      notifyOnBackupSuccess: true,
      notifyOnBackupFailure: true,
      notifyOnRestoreSuccess: true,
      notifyOnRestoreFailure: true,
      notifyOnIntegrityFailure: true,
    },
  });
}
