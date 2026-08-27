import { parseEncryptionKey } from "@/lib/crypto/key";
import { connectionsPointToSameDatabase, parsePostgresUrl } from "@/lib/postgres/url";
import { AppError, ErrorCodes } from "@/lib/errors";
import { configuredSecret } from "@/lib/config/secrets";

export type ConfigIssue = {
  code: string;
  message: string;
  blocksBackup: boolean;
};

export type ConfigIssueSource = {
  isProduction: boolean;
  DATABASE_URL?: string;
  SOURCE_DATABASE_URL?: string;
  BACKUP_ENCRYPTION_KEY?: string;
  AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

function usableDatabaseUrl(value: string | undefined) {
  return configuredSecret(value);
}

export function collectConfigurationIssues(env: ConfigIssueSource): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const sourceUrl = usableDatabaseUrl(env.SOURCE_DATABASE_URL);
  const appUrl = usableDatabaseUrl(env.DATABASE_URL);
  const encryptionKey = configuredSecret(env.BACKUP_ENCRYPTION_KEY);

  if (!sourceUrl) {
    issues.push({
      code: "SOURCE_DATABASE_URL",
      message: "لم يتم ضبط عنوان قاعدة البيانات الأساسية، أو ما زال قيمة إرشادية.",
      blocksBackup: true,
    });
  } else {
    try {
      const source = parsePostgresUrl(sourceUrl);
      const host = source.host.toLowerCase();
      const isLoopback =
        host === "localhost" ||
        host === "::1" ||
        host === "0.0.0.0" ||
        host.startsWith("127.");
      if (env.isProduction && isLoopback) {
        issues.push({
          code: "SOURCE_DATABASE_URL_LOOPBACK",
          message:
            "قاعدة المصدر تشير إلى localhost، وهو غير متاح من خدمة Render. استخدم رابط PostgreSQL خارجي أو خاص قابل للوصول.",
          blocksBackup: true,
        });
      }
    } catch {
      issues.push({
        code: "SOURCE_DATABASE_URL_INVALID",
        message: "عنوان قاعدة البيانات الأساسية غير صالح.",
        blocksBackup: true,
      });
    }
  }

  if (!appUrl) {
    issues.push({
      code: "DATABASE_URL",
      message: "لم يتم ضبط قاعدة بيانات مركز النسخ، أو ما زالت قيمة إرشادية.",
      blocksBackup: true,
    });
  }

  if (sourceUrl && appUrl) {
    try {
      if (connectionsPointToSameDatabase(sourceUrl, appUrl)) {
        issues.push({
          code: ErrorCodes.SOURCE_EQUALS_APP_DB,
          message: "قاعدة المصدر وقاعدة مركز النسخ تشيران إلى نفس القاعدة.",
          blocksBackup: true,
        });
      }
    } catch {
      // parse errors already captured
    }
  }

  if (!encryptionKey) {
    issues.push({
      code: ErrorCodes.ENCRYPTION_KEY_INVALID,
      message:
        "مفتاح التشفير غير مضبوط أو ما زال قيمة إرشادية. أنشئ مفتاحاً عبر npm run keygen والصق قيمة hex ذات 64 خانة في Render دون علامات اقتباس أو مسافات أو بادئة hex:.",
      blocksBackup: true,
    });
  } else {
    try {
      parseEncryptionKey(encryptionKey);
    } catch {
      issues.push({
        code: ErrorCodes.ENCRYPTION_KEY_INVALID,
        message: "مفتاح التشفير غير صالح. استخدم 32 بايت hex (64 خانة) أو base64 دقيق دون أي قيمة إرشادية.",
        blocksBackup: true,
      });
    }
  }

  if (!configuredSecret(env.RESEND_API_KEY) || !configuredSecret(env.RESEND_FROM_EMAIL)) {
    issues.push({
      code: "RESEND",
      message: "إعدادات البريد (Resend) غير مكتملة. لن تُرسل التنبيهات.",
      blocksBackup: false,
    });
  }

  return issues;
}

export function blockingConfigurationCodes(issues: ConfigIssue[]) {
  return issues.filter((issue) => issue.blocksBackup).map((issue) => issue.code);
}

export function publicBlockingConfigurationIssues(issues: ConfigIssue[]): ConfigIssue[] {
  return issues
    .filter((issue) => issue.blocksBackup)
    .map(({ code, message }) => ({ code, message, blocksBackup: true }));
}

export function assertBackupAllowedFromIssues(issues: ConfigIssue[]) {
  const blocking = issues.filter((issue) => issue.blocksBackup);
  if (blocking.length > 0) {
    throw new AppError({
      code: ErrorCodes.CONFIGURATION_ERROR,
      message: blocking[0]?.message,
    });
  }
}
