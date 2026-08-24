import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db/prisma";
import { resolveBackupPath } from "@/lib/storage/paths";
import { logger } from "@/lib/logger";
import { audit, AuditActions } from "@/lib/audit";

export async function applyRetention(keepCount: number) {
  const warnings: string[] = [];
  const successful = await prisma.backup.findMany({
    where: { status: "SUCCESS", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const extra = successful.slice(keepCount);
  for (const backup of extra) {
    try {
      if (backup.fileName) {
        const filePath = resolveBackupPath(backup.fileName);
        await unlink(filePath).catch(() => {
          throw new Error("unlink failed");
        });
      }
      await prisma.backup.update({
        where: { id: backup.id },
        data: { deletedAt: new Date(), storagePath: null },
      });
      await audit({
        action: AuditActions.BACKUP_DELETED,
        resourceType: "Backup",
        resourceId: backup.id,
        result: "SUCCESS",
        metadata: { reason: "retention", backupNumber: backup.backupNumber },
      });
    } catch (error) {
      const message = `Failed to delete backup ${backup.id} during retention`;
      logger.warn({ err: error, backupId: backup.id }, message);
      warnings.push(backup.id);
    }
  }

  return { deleted: extra.length - warnings.length, warnings };
}

export function selectBackupsToDelete<T extends { createdAt: Date }>(items: T[], keepCount: number) {
  return [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(keepCount);
}
