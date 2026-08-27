import "server-only";

import { getEnv } from "@/lib/config/env";
import { AppError, ErrorCodes } from "@/lib/errors";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = getEnv().appUrl;
  if (!origin || !expected || origin !== expected) {
    throw new AppError({ code: ErrorCodes.SAME_ORIGIN_REQUIRED });
  }
}
