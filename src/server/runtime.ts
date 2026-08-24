import "server-only";

import { logger } from "@/lib/logger";
import { bootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import {
  cleanupOrphanRestoreDatabases,
  cleanupTempFiles,
  ensureScheduleInitialized,
  reconcileBackupFiles,
  recoverInterruptedJobs,
} from "@/server/recovery";
import { startScheduler } from "@/lib/scheduler";
import { getConfigurationIssues } from "@/lib/config/issues";
import { hydrateProcessEnvFromFiles } from "@/lib/config/hydrate-env";
import { assertBackupDirWritable } from "@/lib/storage/paths";

let started = false;

export async function startRuntime() {
  if (started) return;
  started = true;
  logger.info("Starting WEPS Backup Center runtime");

  try {
    await assertBackupDirWritable();
  } catch (error) {
    logger.error({ err: error }, "Backup directory is not writable");
  }

  hydrateProcessEnvFromFiles();
  if (!process.env.DATABASE_URL) {
    started = false;
    logger.warn("DATABASE_URL is missing; runtime bootstrap deferred until the database is configured");
    return;
  }

  try {
    await bootstrapAdmin();
    await recoverInterruptedJobs();
    await cleanupTempFiles();
    await cleanupOrphanRestoreDatabases().catch((error) => {
      logger.warn({ err: error }, "Restore DB cleanup skipped");
    });
    await ensureScheduleInitialized();
    await reconcileBackupFiles();
    startScheduler();

    const issues = getConfigurationIssues();
    if (issues.length) {
      logger.warn({ issues: issues.map((item) => item.code) }, "Configuration checklist has items");
    }
  } catch (error) {
    started = false;
    logger.error({ err: error }, "Runtime bootstrap failed; the UI will start in degraded mode");
  }
}
