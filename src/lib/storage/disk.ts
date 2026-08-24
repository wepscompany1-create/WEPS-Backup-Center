import { statfs } from "node:fs/promises";
import path from "node:path";
import { getBackupDir } from "@/lib/storage/paths";

export type DiskUsage = {
  mountPath: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  warning: boolean;
  critical: boolean;
};

export async function getDiskUsage(targetPath = getBackupDir()): Promise<DiskUsage> {
  const resolved = path.resolve(targetPath);
  const stats = await statfs(resolved);
  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const usedPercent = totalBytes === 0 ? 0 : Math.round((usedBytes / totalBytes) * 1000) / 10;

  return {
    mountPath: resolved,
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent,
    warning: usedPercent >= 80,
    critical: usedPercent >= 90,
  };
}

