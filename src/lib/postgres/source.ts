import "server-only";

import { getEnv } from "@/lib/config/env";
import { sanitizeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { postgresCommandRunner } from "@/lib/postgres/command-runner";
import { parsePostgresUrl, toPgEnv } from "@/lib/postgres/url";

export type SourceHealth = {
  connected: boolean;
  latencyMs: number | null;
  serverVersion: string | null;
  clientVersion: string | null;
  incompatible: boolean;
};

function parseMajor(version: string | null) {
  if (!version) return null;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function getPgClientVersions() {
  try {
    const versions = await postgresCommandRunner.assertAvailable();
    return versions;
  } catch {
    return null;
  }
}

export async function getSourceHealth(): Promise<SourceHealth> {
  const env = getEnv();
  const clientVersions = await getPgClientVersions();
  const clientVersion = clientVersions?.pg_dump ?? null;

  if (!env.SOURCE_DATABASE_URL) {
    logger.warn("Source database health check skipped: SOURCE_DATABASE_URL is not configured");
    return {
      connected: false,
      latencyMs: null,
      serverVersion: null,
      clientVersion,
      incompatible: false,
    };
  }

  try {
    const connection = parsePostgresUrl(env.SOURCE_DATABASE_URL);
    const started = Date.now();
    const result = await postgresCommandRunner.run({
      command: "psql",
      args: ["-Atqc", "SHOW server_version;"],
      env: toPgEnv(connection),
      timeoutMs: 15_000,
    });
    const latencyMs = Date.now() - started;
    if (result.code !== 0) {
      logger.warn(
        {
          code: result.code,
          latencyMs,
          detail: result.stderr.trim().slice(0, 500) || undefined,
        },
        "Source database health check failed",
      );
      return {
        connected: false,
        latencyMs,
        serverVersion: null,
        clientVersion,
        incompatible: false,
      };
    }
    const serverVersion = result.stdout.trim().split("\n")[0] || null;
    const serverMajor = parseMajor(serverVersion);
    const clientMajor = parseMajor(clientVersion);
    const incompatible = serverMajor !== null && clientMajor !== null && clientMajor < serverMajor;

    return {
      connected: true,
      latencyMs,
      serverVersion,
      clientVersion,
      incompatible,
    };
  } catch (error) {
    logger.warn(
      {
        errorType: error instanceof Error ? error.name : "UnknownError",
        detail: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
      "Source database health check could not run",
    );
    return {
      connected: false,
      latencyMs: null,
      serverVersion: null,
      clientVersion,
      incompatible: false,
    };
  }
}
