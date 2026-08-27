import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { collectConfigurationIssues, blockingConfigurationCodes } from "@/lib/config/checklist";
import { buildHealthSnapshot } from "@/lib/config/health";
import { getPgClientVersions } from "@/lib/postgres/source";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function GET() {
  let appDb = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    appDb = true;
  } catch {
    appDb = false;
  }

  let diskWritable = false;
  try {
    const { assertBackupDirWritable } = await import("@/lib/storage/paths");
    await assertBackupDirWritable();
    diskWritable = true;
  } catch {
    diskWritable = false;
  }

  const tools = await getPgClientVersions();
  let sourceHealth = {
    connected: false,
    incompatible: false,
  };
  try {
    const { getSourceHealth } = await import("@/lib/postgres/source");
    sourceHealth = await getSourceHealth();
  } catch {
    sourceHealth = { connected: false, incompatible: false };
  }

  const env = getEnv();
  const payload = buildHealthSnapshot({
    appDb,
    diskWritable,
    pgTools: Boolean(tools),
    sourceConnected: sourceHealth.connected,
    sourceIncompatible: sourceHealth.incompatible,
    blockingIssueCodes: blockingConfigurationCodes(collectConfigurationIssues(env)),
    timezone: env.APP_TIMEZONE,
  });

  const response = NextResponse.json(payload, { status: 200 });
  return applySecurityHeaders(response);
}
