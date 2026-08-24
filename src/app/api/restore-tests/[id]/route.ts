import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const { id } = await context.params;
  const test = await prisma.restoreTest.findUnique({
    where: { id },
    include: { backup: { select: { id: true, backupNumber: true } } },
  });
  if (!test) {
    return applySecurityHeaders(NextResponse.json({ code: "BACKUP_NOT_FOUND" }, { status: 404 }));
  }
  return applySecurityHeaders(NextResponse.json({ test }));
}
