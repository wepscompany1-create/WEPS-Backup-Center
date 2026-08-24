import "server-only";

import { getSystemSettings } from "@/lib/db/settings";
import { anyHeavyJobRunning, releaseAdvisoryLock, tryAcquireAdvisoryLock } from "@/lib/db/locks";
import { logger } from "@/lib/logger";
import { enqueueBackup } from "@/features/backup/backup-service";

let timer: NodeJS.Timeout | null = null;
let ticking = false;

export function startScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    void tickScheduler();
  }, 30_000);
  timer.unref?.();
  logger.info("Backup scheduler started");
}

export async function tickScheduler() {
  if (ticking) return;
  ticking = true;
  let advisoryHeld = false;
  try {
    advisoryHeld = await tryAcquireAdvisoryLock();
    if (!advisoryHeld) {
      return;
    }

    const settings = await getSystemSettings();
    if (!settings.scheduleEnabled || !settings.nextScheduledBackupAt) {
      return;
    }
    if (settings.nextScheduledBackupAt.getTime() > Date.now()) {
      return;
    }

    const running = await anyHeavyJobRunning();
    if (running.busy) {
      logger.info("Scheduler skipped; another heavy job is running");
      return;
    }

    logger.info({ dueAt: settings.nextScheduledBackupAt.toISOString() }, "Starting scheduled backup catch-up");
    await enqueueBackup({ type: "SCHEDULED" });
  } catch (error) {
    logger.error({ err: error }, "Scheduler tick failed; next run will retry without skipping the window");
  } finally {
    if (advisoryHeld) {
      await releaseAdvisoryLock().catch((error) => {
        logger.warn({ err: error }, "Failed to release scheduler advisory lock");
      });
    }
    ticking = false;
  }
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
