import { prisma } from "@/lib/db/prisma";
import type { AuditResult, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

export const AuditActions = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  BACKUP_MANUAL_STARTED: "BACKUP_MANUAL_STARTED",
  BACKUP_SCHEDULED_STARTED: "BACKUP_SCHEDULED_STARTED",
  BACKUP_SUCCESS: "BACKUP_SUCCESS",
  BACKUP_FAILED: "BACKUP_FAILED",
  BACKUP_DOWNLOADED: "BACKUP_DOWNLOADED",
  BACKUP_DELETED: "BACKUP_DELETED",
  RESTORE_TEST_STARTED: "RESTORE_TEST_STARTED",
  RESTORE_TEST_SUCCESS: "RESTORE_TEST_SUCCESS",
  RESTORE_TEST_FAILED: "RESTORE_TEST_FAILED",
  PRODUCTION_RESTORE_STARTED: "PRODUCTION_RESTORE_STARTED",
  PRODUCTION_RESTORE_READY: "PRODUCTION_RESTORE_READY",
  PRODUCTION_RESTORE_FAILED: "PRODUCTION_RESTORE_FAILED",
  PRODUCTION_RESTORE_CUTOVER_SUCCESS: "PRODUCTION_RESTORE_CUTOVER_SUCCESS",
  PRODUCTION_RESTORE_CRITICAL: "PRODUCTION_RESTORE_CRITICAL",
  PRODUCTION_PREVIOUS_DROPPED: "PRODUCTION_PREVIOUS_DROPPED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  SCHEDULE_CHANGED: "SCHEDULE_CHANGED",
  EMAIL_TEST_SENT: "EMAIL_TEST_SENT",
  JOB_INTERRUPTED: "JOB_INTERRUPTED",
  RETENTION_WARNING: "RETENTION_WARNING",
} as const;

export async function audit(options: {
  actorId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  result: AuditResult;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.actorId ?? undefined,
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        result: options.result,
        ipAddress: options.ipAddress ?? undefined,
        userAgent: options.userAgent ?? undefined,
        metadata: options.metadata,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: options.action }, "Failed to write audit log");
  }
}
