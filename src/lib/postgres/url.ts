import { randomBytes } from "node:crypto";

export type PostgresConnection = {
  protocol: "postgres" | "postgresql";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslmode?: string;
  searchParams: URLSearchParams;
};

export function parsePostgresUrl(raw: string): PostgresConnection {
  if (!raw || typeof raw !== "string") {
    throw new Error("Database URL is empty");
  }

  const normalized = raw.replace(/^postgresql:/i, "postgres:");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Database URL is not a valid URL");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Database URL must use postgres:// or postgresql://");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("/")[0];
  if (!database) {
    throw new Error("Database URL is missing a database name");
  }

  const sslmode = parsed.searchParams.get("sslmode") || undefined;

  return {
    protocol: "postgres",
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    sslmode,
    searchParams: parsed.searchParams,
  };
}

export function replaceDatabaseName(rawUrl: string, databaseName: string): string {
  const parsed = new URL(rawUrl.replace(/^postgresql:/i, "postgres:"));
  parsed.pathname = `/${encodeURIComponent(databaseName)}`;
  return parsed.toString();
}

export function toPgEnv(connection: PostgresConnection): Record<string, string> {
  const env: Record<string, string> = {
    PGHOST: connection.host,
    PGPORT: String(connection.port),
    PGUSER: connection.user,
    PGPASSWORD: connection.password,
    PGDATABASE: connection.database,
  };

  const sslmode = connection.sslmode || connection.searchParams.get("ssl");
  if (sslmode) {
    env.PGSSLMODE = sslmode === "true" || sslmode === "1" ? "require" : sslmode;
  }

  return env;
}

export function connectionsPointToSameDatabase(aUrl: string, bUrl: string): boolean {
  const a = parsePostgresUrl(aUrl);
  const b = parsePostgresUrl(bUrl);
  return (
    a.host.toLowerCase() === b.host.toLowerCase() &&
    a.port === b.port &&
    a.database === b.database
  );
}

export function isSafeTempDatabaseName(name: string) {
  return /^restore_test_[0-9]{8}_[a-z0-9]{6,16}$/.test(name);
}

export function createTempDatabaseName(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = randomAlphaNum(8);
  return `restore_test_${y}${m}${d}_${rand}`;
}

export function isSafeProductionCandidateName(name: string) {
  return /^prod_restore_[0-9]{8}_[a-z0-9]{6,16}$/.test(name);
}

export function isSafeProductionPreviousName(name: string) {
  return /^prod_previous_[0-9]{8}_[a-z0-9]{6,16}$/.test(name);
}

export function createProductionCandidateName(now = new Date()) {
  return `prod_restore_${utcDateStamp(now)}_${randomAlphaNum(8)}`;
}

export function createProductionPreviousName(now = new Date()) {
  return `prod_previous_${utcDateStamp(now)}_${randomAlphaNum(8)}`;
}

function utcDateStamp(now: Date) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function randomAlphaNum(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function quoteIdent(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error("Refusing to quote unsafe identifier");
  }
  return `"${identifier}"`;
}
