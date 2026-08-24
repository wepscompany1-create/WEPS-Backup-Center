import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getSystemSettings } from "@/lib/db/settings";
import { anyHeavyJobRunning } from "@/lib/db/locks";
import { getSourceHealth } from "@/lib/postgres/source";
import { getDiskUsage } from "@/lib/storage/disk";
import { getConfigurationIssues } from "@/lib/config/issues";
import { getEnv } from "@/lib/config/env";
import { serializeBackup } from "@/features/backup/serialize";
import { notifyDiskWarning } from "@/features/notifications/email-service";
import { logger } from "@/lib/logger";

let lastDiskWarningAt = 0;
const DISK_WARNING_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function maybeNotifyDisk(disk: { warning: boolean; critical: boolean; usedPercent: number } | null) {
  if (!disk || (!disk.warning && !disk.critical)) return;
  const now = Date.now();
  if (now - lastDiskWarningAt < DISK_WARNING_COOLDOWN_MS) return;
  lastDiskWarningAt = now;
  void notifyDiskWarning(disk.usedPercent).catch((error) => {
    logger.warn({ err: error }, "Disk warning notification failed");
  });
}

export async function getDashboardData() {
  const env = getEnv();
  const [settings, source, locks, lastSuccess, lastBackup, lastRestore, counts, disk, issues] =
    await Promise.all([
      getSystemSettings(),
      getSourceHealth(),
      anyHeavyJobRunning(),
      prisma.backup.findFirst({
        where: { status: "SUCCESS", deletedAt: null },
        orderBy: { completedAt: "desc" },
      }),
      prisma.backup.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.restoreTest.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.backup.aggregate({
        where: { status: "SUCCESS", deletedAt: null },
        _count: { _all: true },
        _sum: { encryptedSizeBytes: true },
      }),
      getDiskUsage().catch(() => null),
      Promise.resolve(getConfigurationIssues()),
    ]);

  maybeNotifyDisk(disk);

  return {
    source: {
      connected: source.connected,
      latencyMs: source.latencyMs,
      serverVersion: source.serverVersion,
      clientVersion: source.clientVersion,
      incompatible: source.incompatible,
    },
    lastSuccess: lastSuccess ? serializeBackup(lastSuccess) : null,
    lastBackup: lastBackup ? serializeBackup(lastBackup) : null,
    lastRestore,
    nextScheduledBackupAt: settings.nextScheduledBackupAt,
    scheduleEnabled: settings.scheduleEnabled,
    backupLocalTime: settings.backupLocalTime,
    timezone: settings.timezone,
    notificationEmail: settings.notificationEmail,
    backupCount: counts._count._all,
    retention: env.BACKUP_RETENTION_COUNT,
    totalEncryptedBytes: counts._sum.encryptedSizeBytes?.toString() ?? "0",
    disk,
    jobs: locks,
    issues,
  };
}
