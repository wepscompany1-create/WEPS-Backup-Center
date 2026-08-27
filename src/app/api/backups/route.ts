import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enqueueBackup } from "@/features/backup/backup-service";
import { prisma } from "@/lib/db/prisma";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { applySecurityHeaders } from "@/lib/security/headers";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { serializeBackup } from "@/features/backup/serialize";
import { backupsQuerySchema } from "@/lib/validation/api";
import { getConfigurationIssues } from "@/lib/config/issues";
import { publicBlockingConfigurationIssues } from "@/lib/config/checklist";

export const runtime = "nodejs";

function jsonError(error: unknown) {
  const parsed = toUserError(error);
  const status = error instanceof AppError ? error.httpStatus : 500;
  const issues =
    error instanceof AppError && error.code === ErrorCodes.CONFIGURATION_ERROR
      ? publicBlockingConfigurationIssues(getConfigurationIssues())
      : undefined;
  return applySecurityHeaders(NextResponse.json({ ...parsed, ...(issues ? { issues } : {}) }, { status }));
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }

  const url = new URL(request.url);
  const parsed = backupsQuerySchema.safeParse({
    status: url.searchParams.get("status") || undefined,
    type: url.searchParams.get("type") || undefined,
    q: url.searchParams.get("q") || undefined,
    page: url.searchParams.get("page") || 1,
  });
  if (!parsed.success) {
    return applySecurityHeaders(
      NextResponse.json({ code: ErrorCodes.VALIDATION_ERROR, message: "معاملات التصفية غير صالحة." }, { status: 400 }),
    );
  }

  const { status, type, q, page } = parsed.data;
  const pageSize = 20;
  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [{ id: { contains: q } }, { fileName: { contains: q } }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.backup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { initiatedBy: { select: { email: true } } },
    }),
    prisma.backup.count({ where }),
  ]);

  return applySecurityHeaders(
    NextResponse.json({
      items: items.map(serializeBackup),
      total,
      page,
      pageSize,
    }),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }

  const ip = extractClientIp((name) => request.headers.get(name));
  const rate = consumeRateLimit({
    key: `backup:${session.user.id}`,
    max: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return applySecurityHeaders(
      NextResponse.json({ code: "VALIDATION_ERROR", message: "تجاوزت حد الطلبات." }, { status: 429 }),
    );
  }

  try {
    const backup = await enqueueBackup({
      type: "MANUAL",
      initiatedById: session.user.id,
      ipAddress: ip,
      userAgent: truncateUserAgent(request.headers.get("user-agent")),
    });
    return applySecurityHeaders(NextResponse.json({ jobId: backup.id, backup: serializeBackup(backup) }));
  } catch (error) {
    return jsonError(error);
  }
}
