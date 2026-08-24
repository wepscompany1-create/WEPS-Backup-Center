import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { audit, AuditActions } from "@/lib/audit";
import { generateDownloadFileName } from "@/lib/crypto/filename";
import { AppError, ErrorCodes, toUserError } from "@/lib/errors";
import { extractClientIp, truncateUserAgent } from "@/lib/security/client-ip";
import { applySecurityHeaders } from "@/lib/security/headers";
import { resolveBackupPath } from "@/lib/storage/paths";
import { anyHeavyJobRunning } from "@/lib/db/locks";
import { serializeBackup } from "@/features/backup/serialize";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const { id } = await context.params;
  const backup = await prisma.backup.findUnique({
    where: { id },
    include: {
      initiatedBy: { select: { email: true } },
      restoreTests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!backup) {
    return applySecurityHeaders(NextResponse.json(toUserError(new AppError({ code: ErrorCodes.BACKUP_NOT_FOUND })), { status: 404 }));
  }
  return applySecurityHeaders(
    NextResponse.json({
      backup: serializeBackup(backup),
      restoreTests: backup.restoreTests,
    }),
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const { id } = await context.params;
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) {
    return applySecurityHeaders(NextResponse.json(toUserError(new AppError({ code: ErrorCodes.BACKUP_NOT_FOUND })), { status: 404 }));
  }
  if (backup.status === "RUNNING" || backup.status === "PENDING") {
    return applySecurityHeaders(NextResponse.json({ code: "BACKUP_IN_PROGRESS", message: "لا يمكن حذف نسخة قيد الإنشاء." }, { status: 409 }));
  }
  const activeRestore = await prisma.restoreTest.findFirst({
    where: { backupId: id, status: { in: ["PENDING", "RUNNING"] } },
  });
  const running = await anyHeavyJobRunning();
  if (activeRestore || running.restore) {
    return applySecurityHeaders(NextResponse.json({ code: "RESTORE_IN_PROGRESS", message: "لا يمكن حذف نسخة مستخدمة في اختبار استعادة." }, { status: 409 }));
  }

  if (backup.fileName && !backup.deletedAt) {
    try {
      const filePath = resolveBackupPath(backup.fileName);
      const { unlink } = await import("node:fs/promises");
      await unlink(filePath).catch(() => undefined);
    } catch {
      // continue to mark deleted
    }
  }

  await prisma.backup.update({
    where: { id },
    data: { deletedAt: new Date(), storagePath: null },
  });
  await audit({
    actorId: session.user.id,
    action: AuditActions.BACKUP_DELETED,
    resourceType: "Backup",
    resourceId: id,
    result: "SUCCESS",
    ipAddress: extractClientIp((name) => request.headers.get(name)),
    userAgent: truncateUserAgent(request.headers.get("user-agent")),
  });
  return applySecurityHeaders(NextResponse.json({ ok: true }));
}

export async function downloadBackup(request: Request, id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return applySecurityHeaders(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }));
  }
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup?.fileName || backup.deletedAt) {
    return applySecurityHeaders(NextResponse.json(toUserError(new AppError({ code: ErrorCodes.BACKUP_FILE_MISSING })), { status: 404 }));
  }
  const filePath = resolveBackupPath(backup.fileName);
  const info = await stat(filePath);
  const filename = generateDownloadFileName(backup.createdAt);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  await audit({
    actorId: session.user.id,
    action: AuditActions.BACKUP_DOWNLOADED,
    resourceType: "Backup",
    resourceId: id,
    result: "SUCCESS",
    ipAddress: extractClientIp((name) => request.headers.get(name)),
    userAgent: truncateUserAgent(request.headers.get("user-agent")),
  });
  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
  return applySecurityHeaders(response);
}
