import { randomBytes } from "node:crypto";

export const ErrorCodes = {
  SOURCE_DB_UNREACHABLE: "SOURCE_DB_UNREACHABLE",
  PG_DUMP_FAILED: "PG_DUMP_FAILED",
  BACKUP_FILE_EMPTY: "BACKUP_FILE_EMPTY",
  INTEGRITY_CHECK_FAILED: "INTEGRITY_CHECK_FAILED",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DISK_WRITE_FAILED: "DISK_WRITE_FAILED",
  DISK_FULL: "DISK_FULL",
  RETENTION_DELETE_FAILED: "RETENTION_DELETE_FAILED",
  RESTORE_DECRYPT_FAILED: "RESTORE_DECRYPT_FAILED",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",
  TEMP_DB_CREATE_FAILED: "TEMP_DB_CREATE_FAILED",
  PG_RESTORE_FAILED: "PG_RESTORE_FAILED",
  RESTORE_VALIDATION_FAILED: "RESTORE_VALIDATION_FAILED",
  TEMP_DB_DROP_FAILED: "TEMP_DB_DROP_FAILED",
  RESEND_FAILED: "RESEND_FAILED",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  ENCRYPTION_KEY_INVALID: "ENCRYPTION_KEY_INVALID",
  SOURCE_EQUALS_APP_DB: "SOURCE_EQUALS_APP_DB",
  PG_TOOLS_MISSING: "PG_TOOLS_MISSING",
  PG_VERSION_INCOMPATIBLE: "PG_VERSION_INCOMPATIBLE",
  BACKUP_IN_PROGRESS: "BACKUP_IN_PROGRESS",
  RESTORE_IN_PROGRESS: "RESTORE_IN_PROGRESS",
  JOB_CONFLICT: "JOB_CONFLICT",
  BACKUP_NOT_FOUND: "BACKUP_NOT_FOUND",
  BACKUP_FILE_MISSING: "BACKUP_FILE_MISSING",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PATH_TRAVERSAL: "PATH_TRAVERSAL",
  UNSAFE_DATABASE_NAME: "UNSAFE_DATABASE_NAME",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGIN_FAILED: "LOGIN_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  PRODUCTION_RESTORE_IN_PROGRESS: "PRODUCTION_RESTORE_IN_PROGRESS",
  PRODUCTION_RESTORE_NOT_ELIGIBLE: "PRODUCTION_RESTORE_NOT_ELIGIBLE",
  PRODUCTION_RESTORE_NOT_FOUND: "PRODUCTION_RESTORE_NOT_FOUND",
  RESTORE_TEST_REQUIRED: "RESTORE_TEST_REQUIRED",
  REAUTH_FAILED: "REAUTH_FAILED",
  SAME_ORIGIN_REQUIRED: "SAME_ORIGIN_REQUIRED",
  OUTSIDE_MAINTENANCE_WINDOW: "OUTSIDE_MAINTENANCE_WINDOW",
  CUTOVER_PERMISSION_DENIED: "CUTOVER_PERMISSION_DENIED",
  CUTOVER_ACTIVE_CONNECTIONS: "CUTOVER_ACTIVE_CONNECTIONS",
  CUTOVER_PARTIAL_FAILURE: "CUTOVER_PARTIAL_FAILURE",
  PREVIOUS_RETENTION_ACTIVE: "PREVIOUS_RETENTION_ACTIVE",
  INVALID_RESTORE_STATE: "INVALID_RESTORE_STATE",
  CANDIDATE_CLEANUP_FAILED: "CANDIDATE_CLEANUP_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const arabicMessages: Record<ErrorCode, string> = {
  SOURCE_DB_UNREACHABLE: "تعذر الاتصال بقاعدة البيانات الأساسية.",
  PG_DUMP_FAILED: "فشل إنشاء النسخة الاحتياطية من قاعدة البيانات.",
  BACKUP_FILE_EMPTY: "ملف النسخة الاحتياطية فارغ أو غير صالح.",
  INTEGRITY_CHECK_FAILED: "فشل التحقق من سلامة ملف النسخة.",
  ENCRYPTION_FAILED: "فشل تشفير النسخة الاحتياطية.",
  DISK_WRITE_FAILED: "تعذر حفظ النسخة على قرص التخزين.",
  DISK_FULL: "مساحة التخزين غير كافية لإنشاء نسخة جديدة.",
  RETENTION_DELETE_FAILED: "تعذر حذف نسخة قديمة ضمن سياسة الاحتفاظ.",
  RESTORE_DECRYPT_FAILED: "فشل فك تشفير النسخة أثناء اختبار الاستعادة.",
  CHECKSUM_MISMATCH: "قيمة SHA-256 لا تطابق السجل. النسخة قد تكون تالفة.",
  TEMP_DB_CREATE_FAILED: "تعذر إنشاء قاعدة الاختبار المؤقتة.",
  PG_RESTORE_FAILED: "فشل استعادة النسخة إلى قاعدة الاختبار.",
  RESTORE_VALIDATION_FAILED: "فشلت فحوصات التحقق بعد الاستعادة.",
  TEMP_DB_DROP_FAILED: "تعذر حذف قاعدة الاختبار المؤقتة. يتطلب تدخلاً يدوياً.",
  RESEND_FAILED: "تعذر إرسال رسالة البريد الإلكتروني.",
  CONFIGURATION_ERROR: "إعدادات النظام غير مكتملة أو غير صالحة.",
  ENCRYPTION_KEY_INVALID: "مفتاح التشفير غير صالح. يجب أن يكون 32 بايت (hex أو base64).",
  SOURCE_EQUALS_APP_DB: "قاعدة المصدر وقاعدة مركز النسخ تشيران إلى نفس القاعدة. النسخ متوقف.",
  PG_TOOLS_MISSING: "أدوات PostgreSQL (pg_dump/pg_restore/psql) غير متوفرة في بيئة التشغيل.",
  PG_VERSION_INCOMPATIBLE: "إصدار عميل PostgreSQL أقدم من الخادم ولا يمكنه أخذ نسخة متوافقة.",
  BACKUP_IN_PROGRESS: "توجد عملية نسخ احتياطي قيد التنفيذ.",
  RESTORE_IN_PROGRESS: "يوجد اختبار استعادة قيد التنفيذ.",
  JOB_CONFLICT: "لا يمكن تشغيل هذه العملية الآن بسبب عملية أخرى تستخدم الموارد.",
  BACKUP_NOT_FOUND: "النسخة الاحتياطية غير موجودة.",
  BACKUP_FILE_MISSING: "ملف النسخة غير موجود على القرص.",
  UNAUTHORIZED: "يجب تسجيل الدخول للمتابعة.",
  VALIDATION_ERROR: "البيانات المدخلة غير صالحة.",
  PATH_TRAVERSAL: "مسار الملف غير مسموح به.",
  UNSAFE_DATABASE_NAME: "اسم قاعدة البيانات المؤقتة غير آمن.",
  LOGIN_LOCKED: "تم قفل الحساب مؤقتاً بعد محاولات دخول فاشلة.",
  LOGIN_FAILED: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  RATE_LIMITED: "تجاوزت حد الطلبات. حاول لاحقاً.",
  PRODUCTION_RESTORE_IN_PROGRESS: "توجد عملية استعادة إنتاج تستخدم الموارد الآن.",
  PRODUCTION_RESTORE_NOT_ELIGIBLE: "هذه النسخة غير مؤهلة لاستعادة الإنتاج.",
  PRODUCTION_RESTORE_NOT_FOUND: "عملية استعادة الإنتاج غير موجودة.",
  RESTORE_TEST_REQUIRED: "يلزم اختبار استعادة ناجح لنفس النسخة قبل استعادة الإنتاج.",
  REAUTH_FAILED: "كلمة المرور الحالية غير صحيحة أو الحساب غير نشط.",
  SAME_ORIGIN_REQUIRED: "رُفض الطلب لأنه لم يصدر من واجهة النظام الموثوقة.",
  OUTSIDE_MAINTENANCE_WINDOW: "استعادة الإنتاج متاحة فقط داخل نافذة الصيانة المحددة.",
  CUTOVER_PERMISSION_DENIED: "لا يملك مستخدم PostgreSQL صلاحية إعادة تسمية قواعد البيانات.",
  CUTOVER_ACTIVE_CONNECTIONS: "لا يمكن التبديل مع وجود اتصالات مفتوحة بقاعدة الإنتاج. أوقف التطبيق المصدر أولاً.",
  CUTOVER_PARTIAL_FAILURE: "فشل التبديل بعد إعادة تسمية جزئية. اتبع دليل التعافي فوراً.",
  PREVIOUS_RETENTION_ACTIVE: "لا يمكن حذف قاعدة التراجع قبل انتهاء مدة الاحتفاظ.",
  INVALID_RESTORE_STATE: "لا تسمح الحالة الحالية بتنفيذ هذا الإجراء.",
  CANDIDATE_CLEANUP_FAILED: "تعذر تنظيف قاعدة الاستعادة المرشحة. يلزم تدخل يدوي.",
  INTERNAL_ERROR: "حدث خطأ غير متوقع. راجع رقم المرجع مع المسؤول.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly referenceId: string;
  readonly userMessage: string;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(options: {
    code: ErrorCode;
    message?: string;
    cause?: unknown;
    httpStatus?: number;
    retryable?: boolean;
    referenceId?: string;
  }) {
    super(options.message || options.code);
    this.name = "AppError";
    this.code = options.code;
    this.referenceId = options.referenceId || createReferenceId();
    this.userMessage =
      options.code === ErrorCodes.CONFIGURATION_ERROR && options.message
        ? options.message
        : arabicMessages[options.code];
    this.httpStatus = options.httpStatus ?? defaultStatus(options.code);
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function createReferenceId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  return `WBC-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function toUserError(error: unknown): { code: ErrorCode; message: string; referenceId: string } {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.userMessage,
      referenceId: error.referenceId,
    };
  }
  const referenceId = createReferenceId();
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: arabicMessages.INTERNAL_ERROR,
    referenceId,
  };
}

export function sanitizeErrorMessage(raw: string) {
  return raw
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/postgresql:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/password\s*=\s*[^;\s]+/gi, "password=[redacted]")
    .replace(/PGPASSWORD=[^\s]+/gi, "PGPASSWORD=[redacted]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]");
}

function defaultStatus(code: ErrorCode) {
  switch (code) {
    case ErrorCodes.UNAUTHORIZED:
    case ErrorCodes.LOGIN_FAILED:
      return 401;
    case ErrorCodes.LOGIN_LOCKED:
      return 423;
    case ErrorCodes.RATE_LIMITED:
      return 429;
    case ErrorCodes.RESEND_FAILED:
      return 502;
    case ErrorCodes.VALIDATION_ERROR:
    case ErrorCodes.PATH_TRAVERSAL:
    case ErrorCodes.UNSAFE_DATABASE_NAME:
    case ErrorCodes.SAME_ORIGIN_REQUIRED:
      return 400;
    case ErrorCodes.BACKUP_NOT_FOUND:
    case ErrorCodes.PRODUCTION_RESTORE_NOT_FOUND:
      return 404;
    case ErrorCodes.BACKUP_IN_PROGRESS:
    case ErrorCodes.RESTORE_IN_PROGRESS:
    case ErrorCodes.JOB_CONFLICT:
    case ErrorCodes.PRODUCTION_RESTORE_IN_PROGRESS:
    case ErrorCodes.RESTORE_TEST_REQUIRED:
    case ErrorCodes.OUTSIDE_MAINTENANCE_WINDOW:
    case ErrorCodes.CUTOVER_ACTIVE_CONNECTIONS:
    case ErrorCodes.PREVIOUS_RETENTION_ACTIVE:
    case ErrorCodes.INVALID_RESTORE_STATE:
      return 409;
    case ErrorCodes.PRODUCTION_RESTORE_NOT_ELIGIBLE:
    case ErrorCodes.REAUTH_FAILED:
      return 422;
    case ErrorCodes.CONFIGURATION_ERROR:
    case ErrorCodes.ENCRYPTION_KEY_INVALID:
    case ErrorCodes.SOURCE_EQUALS_APP_DB:
    case ErrorCodes.PG_TOOLS_MISSING:
    case ErrorCodes.PG_VERSION_INCOMPATIBLE:
      return 503;
    default:
      return 500;
  }
}
