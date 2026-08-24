import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardData } from "@/features/backup/dashboard-data";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const data = await getDashboardData();
  return applySecurityHeaders(NextResponse.json(data));
}
