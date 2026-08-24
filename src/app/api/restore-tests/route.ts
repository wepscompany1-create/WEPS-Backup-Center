import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enqueueRestoreTest } from "@/features/restore/restore-service";
import { prisma } from "@/lib/db/prisma";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { applySecurityHeaders } from "@/lib/security/headers";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { restoreTestBodySchema } from "@/lib/validation/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const pageSize = 20;
  const [items, total] = await Promise.all([
    prisma.restoreTest.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        backup: { select: { id: true, backupNumber: true, fileName: true } },
        initiatedBy: { select: { email: true } },
      },
    }),
    prisma.restoreTest.count(),
  ]);
  return applySecurityHeaders(NextResponse.json({ items, total, page, pageSize }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const rate = consumeRateLimit({
    key: `restore:${session.user.id}`,
    max: 4,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return applySecurityHeaders(NextResponse.json({ message: "تجاوزت حد الطلبات." }, { status: 429 }));
  }
  try {
    const json = await request.json();
    const body = restoreTestBodySchema.safeParse(json);
    if (!body.success) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR });
    }
    const test = await enqueueRestoreTest({
      backupId: body.data.backupId,
      initiatedById: session.user.id,
      ipAddress: extractClientIp((name) => request.headers.get(name)),
      userAgent: truncateUserAgent(request.headers.get("user-agent")),
    });
    return applySecurityHeaders(NextResponse.json({ jobId: test.id, test }));
  } catch (error) {
    const parsed = toUserError(error);
    const status = error instanceof AppError ? error.httpStatus : 500;
    return applySecurityHeaders(NextResponse.json(parsed, { status }));
  }
}
