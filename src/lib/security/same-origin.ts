import "server-only";

import { getEnv } from "@/lib/config/env";
import { AppError, ErrorCodes } from "@/lib/errors";
import { isTrustedOrigin } from "@/lib/security/trusted-origin";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = getEnv().appUrl;
  const host = request.headers.get("host");
  if (!isTrustedOrigin(origin, expected, host)) {
    throw new AppError({ code: ErrorCodes.SAME_ORIGIN_REQUIRED });
  }
}
