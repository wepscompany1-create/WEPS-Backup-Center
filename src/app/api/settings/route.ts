import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSystemSettings } from "@/lib/db/settings";
import { settingsUpdateSchema, updateSettings } from "@/features/settings/settings-service";
import { applySecurityHeaders } from "@/lib/security/headers";
import { AppError, toUserError } from "@/lib/errors";
import { getEnv } from "@/lib/config/env";
import { getPgClientVersions } from "@/lib/postgres/source";
import { getDiskUsage } from "@/lib/storage/disk";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const [settings, tools, disk] = await Promise.all([
    getSystemSettings(),
    getPgClientVersions(),
    getDiskUsage().catch(() => null),
  ]);
  const env = getEnv();
  return applySecurityHeaders(
    NextResponse.json({
      settings,
      system: {
        backupDir: env.BACKUP_DIR,
        retention: env.BACKUP_RETENTION_COUNT,
        encryption: "AES-256-GCM",
        timezone: env.APP_TIMEZONE,
        pgTools: tools,
        disk,
        appVersion: "1.0.0",
      },
    }),
  );
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  try {
    const json = await request.json();
    const parsed = settingsUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json({ code: "VALIDATION_ERROR", message: "البيانات المدخلة غير صالحة." }, { status: 400 }),
      );
    }
    const settings = await updateSettings(parsed.data, session.user.id);
    return applySecurityHeaders(NextResponse.json({ settings }));
  } catch (error) {
    const parsed = toUserError(error);
    const status = error instanceof AppError ? error.httpStatus : 500;
    return applySecurityHeaders(NextResponse.json(parsed, { status }));
  }
}
