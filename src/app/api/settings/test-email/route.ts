import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { triggerTestEmail } from "@/features/settings/settings-service";
import { emailResultResponse } from "@/features/notifications/email-result";
import { applySecurityHeaders } from "@/lib/security/headers";
import { consumeRateLimit, testEmailRateLimitKey } from "@/lib/security/rate-limit";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { testEmailSchema } from "@/lib/validation/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(
      NextResponse.json({ code: ErrorCodes.UNAUTHORIZED, message: "يجب تسجيل الدخول للمتابعة." }, { status: 401 }),
    );
  }

  const rate = consumeRateLimit({
    key: testEmailRateLimitKey(session.user.id),
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return applySecurityHeaders(
      NextResponse.json(
        { code: ErrorCodes.RATE_LIMITED, message: "تجاوزت حد طلبات اختبار البريد. حاول لاحقاً." },
        { status: 429 },
      ),
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return applySecurityHeaders(
      NextResponse.json(
        { code: ErrorCodes.VALIDATION_ERROR, message: "أدخل عنوان بريد صالح قبل إرسال الاختبار." },
        { status: 400 },
      ),
    );
  }

  const parsed = testEmailSchema.safeParse(json);
  if (!parsed.success) {
    return applySecurityHeaders(
      NextResponse.json(
        { code: ErrorCodes.VALIDATION_ERROR, message: "أدخل عنوان بريد صالح قبل إرسال الاختبار." },
        { status: 400 },
      ),
    );
  }

  try {
    const result = await triggerTestEmail(parsed.data.email, session.user.id);
    const payload = emailResultResponse(result);
    const { status, ...body } = payload;
    return applySecurityHeaders(NextResponse.json(body, { status }));
  } catch (error) {
    const parsedError = toUserError(error);
    const status = error instanceof AppError ? error.httpStatus : 500;
    return applySecurityHeaders(NextResponse.json(parsedError, { status }));
  }
}
