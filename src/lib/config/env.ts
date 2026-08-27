import path from "node:path";
import { z } from "zod";
import { hydrateProcessEnvFromFiles } from "@/lib/config/hydrate-env";
import { isPlaceholderSecret, isUsableSecret } from "@/lib/config/secrets";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  APP_URL: optionalUrl,
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: optionalUrl,
  NEXTAUTH_URL: optionalUrl,
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

function normalizeAppOrigin(value: string, isProduction: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("APP_URL must be an HTTP(S) origin without credentials");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_URL must contain only the public origin (no path, query, or hash)");
  }

  const hostname = url.hostname.toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.");
  if (isProduction && (url.protocol !== "https:" || isLoopback)) {
    throw new Error("APP_URL must use a public HTTPS origin in production");
  }

  return url.origin;
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
  if (isProduction && !isBuildTime) {
    if (!isUsableSecret(parsed.AUTH_SECRET, 32)) {
      throw new Error("AUTH_SECRET is required in production (min 32 characters, not a placeholder)");
    }
    if (
      parsed.BACKUP_ENCRYPTION_KEY &&
      !isPlaceholderSecret(parsed.BACKUP_ENCRYPTION_KEY) &&
      parsed.AUTH_SECRET?.trim() === parsed.BACKUP_ENCRYPTION_KEY.trim()
    ) {
      throw new Error("AUTH_SECRET must not reuse BACKUP_ENCRYPTION_KEY");
    }
  }
  const configuredAppUrl = parsed.APP_URL || parsed.AUTH_URL || parsed.NEXTAUTH_URL;
  if (isProduction && !configuredAppUrl && !isBuildTime) {
    throw new Error("APP_URL is required in production");
  }
  const appUrl = configuredAppUrl
    ? normalizeAppOrigin(configuredAppUrl, isProduction && !isBuildTime)
    : isProduction
      ? ""
      : "http://localhost:3000";

  if (source === process.env && appUrl) {
    // APP_URL is the canonical source of truth. Auth.js reads the aliases
    // directly and otherwise may rewrite production requests to a stale host.
    process.env.APP_URL = appUrl;
    process.env.AUTH_URL = appUrl;
    process.env.NEXTAUTH_URL = appUrl;
  }

  return {
    ...parsed,
    APP_URL: appUrl || parsed.APP_URL,
    AUTH_URL: appUrl || parsed.AUTH_URL,
    NEXTAUTH_URL: appUrl || parsed.NEXTAUTH_URL,
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
