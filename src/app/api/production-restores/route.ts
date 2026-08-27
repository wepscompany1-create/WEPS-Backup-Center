import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { applySecurityHeaders } from "@/lib/security/headers";
import { assertSameOrigin } from "@/lib/security/same-origin";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { reauthenticateAdmin } from "@/lib/auth/reauth";
import {
  productionRestoreBodySchema,
  productionRestoresQuerySchema,
} from "@/lib/validation/api";
import {
  enqueueProductionRestore,
  productionRestoreActions,
} from "@/features/restore/production-restore-service";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const url = new URL(request.url);
  const parsed = productionRestoresQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return errorResponse(new AppError({ code: ErrorCodes.VALIDATION_ERROR }));
  }
  const pageSize = 20;
  const where = {
    status: parsed.data.status,
    backup: parsed.data.backupNumber
      ? { backupNumber: parsed.data.backupNumber }
      : undefined,
  };
  const [items, total] = await Promise.all([
    prisma.productionRestore.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.data.page - 1) * pageSize,
      take: pageSize,
      include: {
        backup: { select: { id: true, backupNumber: true } },
        initiatedBy: { select: { email: true } },
      },
    }),
    prisma.productionRestore.count({ where }),
  ]);
  return applySecurityHeaders(
    NextResponse.json({
      items: items.map((item) => ({ ...item, actions: productionRestoreActions(item) })),
      total,
      page: parsed.data.page,
      pageSize,
    }),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  try {
    assertSameOrigin(request);
    const parsed = productionRestoreBodySchema.safeParse(await request.json());
    if (!parsed.success) throw new AppError({ code: ErrorCodes.VALIDATION_ERROR });
    await reauthenticateAdmin(session.user.id, parsed.data.currentPassword);
    const restore = await enqueueProductionRestore({
      backupId: parsed.data.backupId,
      backupNumber: parsed.data.backupNumber,
      mode: parsed.data.mode,
      actorId: session.user.id,
      ipAddress: extractClientIp((name) => request.headers.get(name)),
      userAgent: truncateUserAgent(request.headers.get("user-agent")),
    });
    return applySecurityHeaders(
      NextResponse.json({ jobId: restore.id, restore }, { status: 202 }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const body = toUserError(error);
  return applySecurityHeaders(
    NextResponse.json(body, { status: error instanceof AppError ? error.httpStatus : 500 }),
  );
}
