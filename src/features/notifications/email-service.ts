import "server-only";

import { Resend } from "resend";
import type { Backup, NotificationEvent, ProductionRestore, RestoreTest } from "@prisma/client";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { getSystemSettings } from "@/lib/db/settings";
import { logger } from "@/lib/logger";
import { formatBytes, formatDateTimeAr } from "@/lib/format";
import {
  EMAIL_SAFE_LOG_MESSAGES,
  EmailSendReasons,
  emailSendResult,
  type EmailSendReason,
  type EmailSendResult,
} from "@/features/notifications/email-result";

function getClient() {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

async function recordAttempt(options: {
  event: NotificationEvent;
  subject: string;
  resourceType?: string;
  resourceId?: string;
  toEmail: string;
  result: EmailSendResult;
}) {
  try {
    if (options.result.sent) {
      await prisma.notificationLog.create({
        data: {
          event: options.event,
          status: "SENT",
          toEmail: options.toEmail,
          subject: options.subject,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
        },
      });
      return;
    }

    const safe = EMAIL_SAFE_LOG_MESSAGES[options.result.reason];
    await prisma.notificationLog.create({
      data: {
        event: options.event,
        status: "FAILED",
        toEmail: options.toEmail,
        subject: options.subject,
        errorCode: safe.code,
        errorMessage: safe.message,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
      },
    });
  } catch (error) {
    logger.warn({ err: error, event: options.event }, "Failed to write notification log");
  }
}

async function sendMail(options: {
  event: NotificationEvent;
  subject: string;
  html: string;
  resourceType?: string;
  resourceId?: string;
  to?: string;
}): Promise<EmailSendResult> {
  try {
    const env = getEnv();
    const settings = await getSystemSettings();
    const to = options.to || settings.notificationEmail;
    const logBase = {
      event: options.event,
      subject: options.subject,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
    };

    async function finish(reason: EmailSendReason) {
      const result = emailSendResult(reason);
      await recordAttempt({ ...logBase, toEmail: to || "unspecified", result });
      return result;
    }

    if (!to) {
      return finish(EmailSendReasons.MISSING_RECIPIENT);
    }
    if (!env.RESEND_API_KEY) {
      return finish(EmailSendReasons.MISSING_API_KEY);
    }
    if (!env.RESEND_FROM_EMAIL) {
      return finish(EmailSendReasons.MISSING_FROM_EMAIL);
    }

    const client = getClient();
    if (!client) {
      return finish(EmailSendReasons.MISSING_API_KEY);
    }

    const result = await client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: options.subject,
      html: options.html,
    });
    if (result.error) {
      logger.warn(
        { event: options.event, providerName: result.error.name },
        "Notification email rejected by provider",
      );
      return finish(EmailSendReasons.PROVIDER_REJECTED);
    }

    return finish(EmailSendReasons.SENT);
  } catch (error) {
    logger.warn({ err: error, event: options.event }, "Notification email failed");
    const fallback = emailSendResult(EmailSendReasons.PROVIDER_REJECTED);
    const to = options.to || "unspecified";
    await recordAttempt({
      event: options.event,
      subject: options.subject,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      toEmail: to,
      result: fallback,
    });
    return fallback;
  }
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#F8FAFC;color:#0F172A;padding:24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><h1 style="font-size:18px;">${title}</h1><div style="background:#fff;border:1px solid #E2E8F0;padding:16px;">${body}</div><p style="color:#64748B;font-size:12px;">WEPS Backup Center</p></td></tr></table></body></html>`;
}

export async function notifyBackupResult(options: { backup: Backup; success: boolean }) {
  const settings = await getSystemSettings();
  if (options.success && !settings.notifyOnBackupSuccess) return;
  if (!options.success && !settings.notifyOnBackupFailure) return;

  const when = formatDateTimeAr(options.backup.completedAt || new Date(), settings.timezone);
  if (options.success) {
    await sendMail({
      event: "BACKUP_SUCCESS",
      subject: "نجاح النسخ الاحتياطي — WEPS Backup Center",
      resourceType: "Backup",
      resourceId: options.backup.id,
      html: layout(
        "نجاح النسخ الاحتياطي",
        `<p>اكتملت عملية النسخ الاحتياطي بنجاح.</p><p>المعرّف: ${options.backup.id}</p><p>الوقت: ${when}</p><p>الحجم المشفر: ${options.backup.encryptedSizeBytes ? formatBytes(Number(options.backup.encryptedSizeBytes)) : "—"}</p>`,
      ),
    });
    return;
  }

  if (options.backup.errorCode === "INTEGRITY_CHECK_FAILED" || options.backup.errorCode === "CHECKSUM_MISMATCH") {
    if (settings.notifyOnIntegrityFailure) {
      await sendMail({
        event: "INTEGRITY_FAILURE",
        subject: "تحذير: فشل التحقق من سلامة نسخة احتياطية",
        resourceType: "Backup",
        resourceId: options.backup.id,
        html: layout(
          "فشل التحقق من سلامة النسخة",
          `<p>فشلت عملية التحقق من سلامة النسخة الاحتياطية.</p><p>المعرّف: ${options.backup.id}</p><p>مرجع الخطأ: ${options.backup.errorReferenceId ?? "—"}</p><p>الوقت: ${when}</p>`,
        ),
      });
    }
  }

  await sendMail({
    event: "BACKUP_FAILURE",
    subject: "فشل النسخ الاحتياطي — WEPS Backup Center",
    resourceType: "Backup",
    resourceId: options.backup.id,
    html: layout(
      "فشل النسخ الاحتياطي",
      `<p>فشلت عملية النسخ الاحتياطي.</p><p>المعرّف: ${options.backup.id}</p><p>مرجع الخطأ: ${options.backup.errorReferenceId ?? "—"}</p><p>الوقت: ${when}</p>`,
    ),
  });
}

export async function notifyRestoreResult(options: { test: RestoreTest; success: boolean }) {
  const settings = await getSystemSettings();
  if (options.success && !settings.notifyOnRestoreSuccess) return;
  if (!options.success && !settings.notifyOnRestoreFailure) return;
  const when = formatDateTimeAr(options.test.completedAt || new Date(), settings.timezone);

  if (options.success) {
    await sendMail({
      event: "RESTORE_SUCCESS",
      subject: "نجاح اختبار الاستعادة — WEPS Backup Center",
      resourceType: "RestoreTest",
      resourceId: options.test.id,
      html: layout(
        "نجاح اختبار الاستعادة",
        `<p>اكتمل اختبار الاستعادة بنجاح وتم حذف القاعدة المؤقتة.</p><p>معرف الاختبار: ${options.test.id}</p><p>عدد الجداول: ${options.test.tableCount ?? "—"}</p><p>الوقت: ${when}</p>`,
      ),
    });
    return;
  }

  await sendMail({
    event: "RESTORE_FAILURE",
    subject: "فشل اختبار الاستعادة — WEPS Backup Center",
    resourceType: "RestoreTest",
    resourceId: options.test.id,
    html: layout(
      "فشل اختبار الاستعادة",
      `<p>فشل اختبار الاستعادة.</p><p>معرف الاختبار: ${options.test.id}</p><p>مرجع الخطأ: ${options.test.errorReferenceId ?? "—"}</p><p>الوقت: ${when}</p>`,
    ),
  });
}

export async function notifyProductionRestore(options: {
  restore: ProductionRestore;
  kind: "ready" | "success" | "failure" | "critical" | "previous-dropped";
}) {
  const subjects = {
    ready: "قاعدة استعادة الإنتاج المرشحة جاهزة",
    success: "اكتمل تبديل قاعدة الإنتاج",
    failure: "فشلت استعادة الإنتاج",
    critical: "حالة حرجة أثناء تبديل قاعدة الإنتاج",
    "previous-dropped": "حُذفت قاعدة التراجع السابقة",
  } as const;
  const events = {
    ready: "PRODUCTION_RESTORE_READY",
    success: "PRODUCTION_RESTORE_SUCCESS",
    failure: "PRODUCTION_RESTORE_FAILURE",
    critical: "PRODUCTION_RESTORE_CRITICAL",
    "previous-dropped": "PRODUCTION_PREVIOUS_DROPPED",
  } as const satisfies Record<typeof options.kind, NotificationEvent>;
  await sendMail({
    event: events[options.kind],
    subject: `${subjects[options.kind]} — WEPS Backup Center`,
    resourceType: "ProductionRestore",
    resourceId: options.restore.id,
    html: layout(
      subjects[options.kind],
      `<p>معرف العملية: ${options.restore.id}</p><p>الحالة: ${options.restore.status}</p><p>مرجع الخطأ: ${options.restore.errorReferenceId ?? "—"}</p>`,
    ),
  });
}

export async function notifyDiskWarning(usedPercent: number) {
  await sendMail({
    event: "DISK_WARNING",
    subject: "تحذير: امتلاء قرص النسخ الاحتياطية",
    html: layout(
      "تحذير مساحة التخزين",
      `<p>استخدام القرص وصل إلى ${usedPercent}%.</p><p>راجع النسخ القديمة ومساحة Persistent Disk.</p>`,
    ),
  });
}

export async function sendTestEmail(to: string) {
  return sendMail({
    event: "TEST",
    subject: "رسالة اختبار — WEPS Backup Center",
    to,
    html: layout(
      "رسالة اختبار",
      "<p>هذه رسالة اختبار من WEPS Backup Center. إذا وصلتك الرسالة فإعدادات البريد تعمل.</p>",
    ),
  });
}
