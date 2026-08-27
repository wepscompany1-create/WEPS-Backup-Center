import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dropPreviousProductionDatabase } from "@/features/restore/production-restore-service";
import { reauthenticateAdmin } from "@/lib/auth/reauth";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { applySecurityHeaders } from "@/lib/security/headers";
import { assertSameOrigin } from "@/lib/security/same-origin";
import { productionRestoreDropPreviousSchema } from "@/lib/validation/api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  try {
    assertSameOrigin(request);
    const body = productionRestoreDropPreviousSchema.safeParse(await request.json());
    if (!body.success) throw new AppError({ code: ErrorCodes.VALIDATION_ERROR });
    await reauthenticateAdmin(session.user.id, body.data.currentPassword);
    const { id } = await context.params;
    const restore = await dropPreviousProductionDatabase({
      restoreId: id,
      backupNumber: body.data.backupNumber,
      actorId: session.user.id,
      ipAddress: extractClientIp((name) => request.headers.get(name)),
      userAgent: truncateUserAgent(request.headers.get("user-agent")),
    });
    return applySecurityHeaders(NextResponse.json({ restore }));
  } catch (error) {
    const parsed = toUserError(error);
    return applySecurityHeaders(
      NextResponse.json(parsed, { status: error instanceof AppError ? error.httpStatus : 500 }),
    );
  }
}
