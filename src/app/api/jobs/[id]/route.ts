import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { applySecurityHeaders } from "@/lib/security/headers";
import { serializeBackup } from "@/features/backup/serialize";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const { id } = await context.params;
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (backup) {
    return applySecurityHeaders(NextResponse.json({ kind: "backup", job: serializeBackup(backup) }));
  }
  const restore = await prisma.restoreTest.findUnique({ where: { id } });
  if (restore) {
    return applySecurityHeaders(NextResponse.json({ kind: "restore", job: restore }));
  }
  const productionRestore = await prisma.productionRestore.findUnique({ where: { id } });
  if (productionRestore) {
    return applySecurityHeaders(
      NextResponse.json({ kind: "production-restore", job: productionRestore }),
    );
  }
  return applySecurityHeaders(NextResponse.json({ code: "NOT_FOUND" }, { status: 404 }));
}
