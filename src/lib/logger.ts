import pino from "pino";
import { getEnv } from "@/lib/config/env";

const redactPaths = [
  "password",
  "pass",
  "*.password",
  "*.pass",
  "authorization",
  "cookie",
  "cookies",
  "req.headers.authorization",
  "req.headers.cookie",
  "DATABASE_URL",
  "SOURCE_DATABASE_URL",
  "RESEND_API_KEY",
  "BACKUP_ENCRYPTION_KEY",
  "ADMIN_PASSWORD",
  "AUTH_SECRET",
  "PGPASSWORD",
  "connectionString",
  "databaseUrl",
  "sourceDatabaseUrl",
  "*.DATABASE_URL",
  "*.SOURCE_DATABASE_URL",
  "*.RESEND_API_KEY",
  "*.BACKUP_ENCRYPTION_KEY",
  "*.ADMIN_PASSWORD",
  "*.PGPASSWORD",
];

function createLogger() {
  const env = getEnv();
  const isDev = env.NODE_ENV === "development";

  return pino({
    level: isDev ? "debug" : "info",
    redact: {
      paths: redactPaths,
      censor: "[Redacted]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    transport:
      isDev && process.env.NEXT_RUNTIME !== "edge"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  });
}

export const logger = createLogger();

export function childLogger(bindings: Record<string, string | number | boolean | undefined>) {
  return logger.child(bindings);
}
