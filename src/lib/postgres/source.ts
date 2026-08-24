import "server-only";

import { getEnv } from "@/lib/config/env";
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
  } catch {
    return {
      connected: false,
      latencyMs: null,
      serverVersion: null,
      clientVersion,
      incompatible: false,
    };
  }
}
