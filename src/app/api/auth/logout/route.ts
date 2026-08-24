import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { audit, AuditActions } from "@/lib/audit";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }

  await audit({
    actorId: session.user.id,
    action: AuditActions.LOGOUT,
    result: "SUCCESS",
    ipAddress: extractClientIp((name) => request.headers.get(name)),
    userAgent: truncateUserAgent(request.headers.get("user-agent")),
  });

  return applySecurityHeaders(NextResponse.json({ ok: true }));
}
