import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { ErrorCodes } from "@/lib/errors";
import { applySecurityHeaders } from "@/lib/security/headers";
import { auditQuerySchema } from "@/lib/validation/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const url = new URL(request.url);
  const parsed = auditQuerySchema.safeParse({
    action: url.searchParams.get("action") || undefined,
    result: url.searchParams.get("result") || undefined,
    page: url.searchParams.get("page") || 1,
  });
  if (!parsed.success) {
    return applySecurityHeaders(
      NextResponse.json({ code: ErrorCodes.VALIDATION_ERROR, message: "معاملات التصفية غير صالحة." }, { status: 400 }),
    );
  }
  const { action, result, page } = parsed.data;
  const pageSize = 30;
  const where = {
    ...(action ? { action } : {}),
    ...(result ? { result } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return applySecurityHeaders(NextResponse.json({ items, total, page, pageSize }));
}
