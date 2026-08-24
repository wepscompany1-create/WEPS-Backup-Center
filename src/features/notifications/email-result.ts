export const EmailSendReasons = {
  SENT: "SENT",
  MISSING_RECIPIENT: "MISSING_RECIPIENT",
  MISSING_API_KEY: "MISSING_API_KEY",
  MISSING_FROM_EMAIL: "MISSING_FROM_EMAIL",
  PROVIDER_REJECTED: "PROVIDER_REJECTED",
} as const;

export type EmailSendReason = (typeof EmailSendReasons)[keyof typeof EmailSendReasons];

export type EmailSendResult =
  | { sent: true; skipped: false; reason: typeof EmailSendReasons.SENT }
  | {
      sent: false;
      skipped: boolean;
      reason: Exclude<EmailSendReason, typeof EmailSendReasons.SENT>;
    };

export const EMAIL_USER_MESSAGES: Record<EmailSendReason, string> = {
  SENT: "أُرسلت رسالة الاختبار",
  MISSING_RECIPIENT: "أدخل عنوان بريد صالح قبل إرسال الاختبار.",
  MISSING_API_KEY: "إعدادات إرسال البريد غير مكتملة. مفتاح Resend غير مضبوط.",
  MISSING_FROM_EMAIL: "إعدادات إرسال البريد غير مكتملة. عنوان المرسل غير مضبوط.",
  PROVIDER_REJECTED: "رفض مزود البريد الرسالة. تحقق من توثيق النطاق وعنوان المرسل.",
};

export const EMAIL_SAFE_LOG_MESSAGES: Record<Exclude<EmailSendReason, "SENT">, { code: string; message: string }> = {
  MISSING_RECIPIENT: { code: "MISSING_RECIPIENT", message: "Notification recipient is not set" },
  MISSING_API_KEY: { code: "MISSING_API_KEY", message: "RESEND_API_KEY is not configured" },
  MISSING_FROM_EMAIL: { code: "MISSING_FROM_EMAIL", message: "RESEND_FROM_EMAIL is not configured" },
  PROVIDER_REJECTED: { code: "RESEND_FAILED", message: "Failed to send email" },
};

export function emailSendResult(reason: EmailSendReason): EmailSendResult {
  if (reason === EmailSendReasons.SENT) {
    return { sent: true, skipped: false, reason: EmailSendReasons.SENT };
  }
  return {
    sent: false,
    skipped: reason !== EmailSendReasons.PROVIDER_REJECTED,
    reason,
  };
}

export function emailResultHttpStatus(result: EmailSendResult): number {
  if (result.sent) return 200;
  switch (result.reason) {
    case EmailSendReasons.MISSING_RECIPIENT:
      return 400;
    case EmailSendReasons.MISSING_API_KEY:
    case EmailSendReasons.MISSING_FROM_EMAIL:
      return 503;
    case EmailSendReasons.PROVIDER_REJECTED:
      return 502;
    default:
      return 500;
  }
}

export function emailResultErrorCode(result: EmailSendResult): string {
  if (result.sent) return "OK";
  switch (result.reason) {
    case EmailSendReasons.MISSING_RECIPIENT:
      return "VALIDATION_ERROR";
    case EmailSendReasons.MISSING_API_KEY:
    case EmailSendReasons.MISSING_FROM_EMAIL:
      return "CONFIGURATION_ERROR";
    case EmailSendReasons.PROVIDER_REJECTED:
      return "RESEND_FAILED";
    default:
      return "INTERNAL_ERROR";
  }
}

export function emailResultResponse(result: EmailSendResult) {
  return {
    sent: result.sent,
    skipped: result.skipped,
    reason: result.reason,
    code: emailResultErrorCode(result),
    message: EMAIL_USER_MESSAGES[result.reason],
    status: emailResultHttpStatus(result),
  };
}
