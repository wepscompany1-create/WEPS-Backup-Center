import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSourceHealth } from "@/lib/postgres/source";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const health = await getSourceHealth();
  return applySecurityHeaders(
    NextResponse.json({
      success: health.connected && !health.incompatible,
      latencyMs: health.latencyMs,
      serverVersion: health.serverVersion,
      incompatible: health.incompatible,
    }),
  );
}
