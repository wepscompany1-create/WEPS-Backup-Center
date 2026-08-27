import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { applySecurityHeaders } from "@/lib/security/headers";
import { productionRestoreActions } from "@/features/restore/production-restore-service";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const { id } = await context.params;
  const restore = await prisma.productionRestore.findUnique({
    where: { id },
    include: {
      backup: { select: { id: true, backupNumber: true, createdAt: true, sha256: true } },
      initiatedBy: { select: { email: true } },
      cutoverBy: { select: { email: true } },
      previousDroppedBy: { select: { email: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!restore) {
    const error = new AppError({ code: ErrorCodes.PRODUCTION_RESTORE_NOT_FOUND });
    return applySecurityHeaders(
      NextResponse.json(toUserError(error), { status: error.httpStatus }),
    );
  }
  return applySecurityHeaders(
    NextResponse.json({ restore, actions: productionRestoreActions(restore) }),
  );
}
