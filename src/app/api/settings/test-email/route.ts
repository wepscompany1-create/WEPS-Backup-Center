import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { triggerTestEmail } from "@/features/settings/settings-service";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const result = await triggerTestEmail(session.user.id);
  return applySecurityHeaders(NextResponse.json(result));
}
