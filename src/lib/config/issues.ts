import "server-only";

import { getEnv } from "@/lib/config/env";
import { parseEncryptionKey } from "@/lib/crypto/key";
import { connectionsPointToSameDatabase, parsePostgresUrl } from "@/lib/postgres/url";
import { AppError, ErrorCodes } from "@/lib/errors";

export type ConfigIssue = {
  code: string;
  message: string;
  blocksBackup: boolean;
};

export function getConfigurationIssues() {
  const env = getEnv();
  const issues: ConfigIssue[] = [];

  if (!env.SOURCE_DATABASE_URL) {
    issues.push({
      code: "SOURCE_DATABASE_URL",
      message: "لم يتم ضبط عنوان قاعدة البيانات الأساسية.",
      blocksBackup: true,
    });
  } else {
    try {
      parsePostgresUrl(env.SOURCE_DATABASE_URL);
    } catch {
      issues.push({
        code: "SOURCE_DATABASE_URL_INVALID",
        message: "عنوان قاعدة البيانات الأساسية غير صالح.",
        blocksBackup: true,
      });
    }
  }

  if (!env.DATABASE_URL) {
    issues.push({
      code: "DATABASE_URL",
      message: "لم يتم ضبط قاعدة بيانات مركز النسخ.",
      blocksBackup: true,
    });
  }

  if (env.SOURCE_DATABASE_URL && env.DATABASE_URL) {
    try {
      if (connectionsPointToSameDatabase(env.SOURCE_DATABASE_URL, env.DATABASE_URL)) {
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

  if (!env.BACKUP_ENCRYPTION_KEY) {
    issues.push({
      code: ErrorCodes.ENCRYPTION_KEY_INVALID,
      message: "مفتاح التشفير غير مضبوط.",
      blocksBackup: true,
    });
  } else {
    try {
      parseEncryptionKey(env.BACKUP_ENCRYPTION_KEY);
    } catch {
      issues.push({
        code: ErrorCodes.ENCRYPTION_KEY_INVALID,
        message: "مفتاح التشفير غير صالح. استخدم 32 بايت hex أو base64.",
        blocksBackup: true,
      });
    }
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    issues.push({
      code: "RESEND",
      message: "إعدادات البريد (Resend) غير مكتملة. لن تُرسل التنبيهات.",
      blocksBackup: false,
    });
  }

  return issues;
}

export function assertBackupAllowed() {
  const blocking = getConfigurationIssues().filter((issue) => issue.blocksBackup);
  if (blocking.length > 0) {
    throw new AppError({
      code: ErrorCodes.CONFIGURATION_ERROR,
      message: blocking.map((item) => item.message).join(" "),
    });
  }
}
