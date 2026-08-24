import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
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
  let sourceConnected = false;
  try {
    const { getSourceHealth } = await import("@/lib/postgres/source");
    sourceConnected = (await getSourceHealth()).connected;
  } catch {
    sourceConnected = false;
  }

  const payload = {
    status: appDb ? "ok" : "degraded",
    app: true,
    appDb,
    diskWritable,
    pgTools: Boolean(tools),
    sourceDb: sourceConnected,
    timezone: getEnv().APP_TIMEZONE,
  };

  const response = NextResponse.json(payload, { status: 200 });
  return applySecurityHeaders(response);
}
