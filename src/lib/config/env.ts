import path from "node:path";
import { z } from "zod";
import { hydrateProcessEnvFromFiles } from "@/lib/config/hydrate-env";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  APP_URL: z.string().trim().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().trim().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SOURCE_DATABASE_URL: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  BACKUP_DIR: z.string().min(1).optional(),
  BACKUP_RETENTION_COUNT: z.coerce.number().int().min(1).max(100).default(7),
  APP_TIMEZONE: z.string().default("Asia/Aden"),
  RESEND_API_KEY: optionalUrl,
  RESEND_FROM_EMAIL: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  SESSION_MAX_AGE_MINUTES: z.coerce.number().int().min(15).max(10080).default(480),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(3).max(100).default(10),
});

export type AppEnv = Omit<z.infer<typeof envSchema>, "BACKUP_DIR"> & {
  isProduction: boolean;
  appUrl: string;
  BACKUP_DIR: string;
};

let cached: AppEnv | null = null;

function defaultBackupDir(isProduction: boolean) {
  if (!isProduction && process.platform === "win32") {
    return path.join(process.cwd(), "data", "backups");
  }
  return "/var/data/backups";
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source === process.env) {
    hydrateProcessEnvFromFiles();
  }
  const parsed = envSchema.parse(source);
  const isProduction = parsed.NODE_ENV === "production";
  const isBuildTime =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build";
  if (isProduction && !parsed.AUTH_SECRET && !isBuildTime) {
    throw new Error("AUTH_SECRET is required in production (min 32 characters)");
  }
  const appUrl =
    parsed.APP_URL ||
    parsed.AUTH_URL ||
    (isProduction ? "" : "http://localhost:3000");

  return {
    ...parsed,
    BACKUP_DIR: parsed.BACKUP_DIR || defaultBackupDir(isProduction),
    isProduction,
    appUrl,
  };
}

export function getEnv(): AppEnv {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

export function resetEnvCache() {
  cached = null;
}

export function requireSecret(name: "AUTH_SECRET" | "DATABASE_URL", env = getEnv()): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
