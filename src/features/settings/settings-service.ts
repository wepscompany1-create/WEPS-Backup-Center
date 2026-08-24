import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSystemSettings } from "@/lib/db/settings";
import { computeNextScheduledBackupAt, isValidLocalTime } from "@/lib/scheduler/next-run";
import { audit, AuditActions } from "@/lib/audit";
import { sendTestEmail } from "@/features/notifications/email-service";
import { AppError, ErrorCodes } from "@/lib/errors";

export const settingsUpdateSchema = z.object({
  scheduleEnabled: z.boolean().optional(),
  backupLocalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "صيغة الوقت يجب أن تكون HH:mm")
    .optional(),
  notificationEmail: z.string().email("بريد غير صالح").nullable().optional(),
  notifyOnBackupSuccess: z.boolean().optional(),
  notifyOnBackupFailure: z.boolean().optional(),
  notifyOnRestoreSuccess: z.boolean().optional(),
  notifyOnRestoreFailure: z.boolean().optional(),
  notifyOnIntegrityFailure: z.boolean().optional(),
});

export async function updateSettings(input: z.infer<typeof settingsUpdateSchema>, actorId?: string) {
  const current = await getSystemSettings();
  const backupLocalTime = input.backupLocalTime ?? current.backupLocalTime;
  if (!isValidLocalTime(backupLocalTime)) {
    throw new AppError({ code: ErrorCodes.VALIDATION_ERROR });
  }

  const scheduleChanged =
    input.scheduleEnabled !== undefined && input.scheduleEnabled !== current.scheduleEnabled
      ? true
      : Boolean(input.backupLocalTime && input.backupLocalTime !== current.backupLocalTime);

  const nextScheduledBackupAt = scheduleChanged
    ? computeNextScheduledBackupAt({
        now: new Date(),
        localTime: backupLocalTime,
        timezone: current.timezone,
        intervalDays: current.backupIntervalDays,
      })
    : current.nextScheduledBackupAt;

  const updated = await prisma.systemSettings.update({
    where: { id: current.id },
    data: {
      scheduleEnabled: input.scheduleEnabled ?? current.scheduleEnabled,
      backupLocalTime,
      notificationEmail:
        input.notificationEmail === undefined ? current.notificationEmail : input.notificationEmail,
      notifyOnBackupSuccess: input.notifyOnBackupSuccess ?? current.notifyOnBackupSuccess,
      notifyOnBackupFailure: input.notifyOnBackupFailure ?? current.notifyOnBackupFailure,
      notifyOnRestoreSuccess: input.notifyOnRestoreSuccess ?? current.notifyOnRestoreSuccess,
      notifyOnRestoreFailure: input.notifyOnRestoreFailure ?? current.notifyOnRestoreFailure,
      notifyOnIntegrityFailure: input.notifyOnIntegrityFailure ?? current.notifyOnIntegrityFailure,
      nextScheduledBackupAt,
    },
  });

  await audit({
    actorId,
    action: scheduleChanged ? AuditActions.SCHEDULE_CHANGED : AuditActions.SETTINGS_UPDATED,
    resourceType: "SystemSettings",
    resourceId: updated.id,
    result: "SUCCESS",
    metadata: {
      scheduleEnabled: updated.scheduleEnabled,
      backupLocalTime: updated.backupLocalTime,
    },
  });

  return updated;
}

export async function triggerTestEmail(actorId?: string) {
  const result = await sendTestEmail();
  await audit({
    actorId,
    action: AuditActions.EMAIL_TEST_SENT,
    resourceType: "Notification",
    result: result.sent ? "SUCCESS" : "FAILURE",
  });
  return result;
}
