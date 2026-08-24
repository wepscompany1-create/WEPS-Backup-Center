import { chmod, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { AppError, ErrorCodes } from "@/lib/errors";
import { getEnv } from "@/lib/config/env";

export function getBackupDir() {
  return getEnv().BACKUP_DIR;
}

export async function ensureBackupDir() {
  const dir = getBackupDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function assertBackupDirWritable() {
  const dir = await ensureBackupDir();
  const probe = path.join(dir, ".write-test");
  const { writeFile, rm } = await import("node:fs/promises");
  await writeFile(probe, "ok", { mode: 0o600 });
  await rm(probe, { force: true });
  return dir;
}

export function resolveBackupPath(fileName: string) {
  if (!fileName || fileName.includes("\0")) {
    throw new AppError({ code: ErrorCodes.PATH_TRAVERSAL, message: "Empty file name" });
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new AppError({ code: ErrorCodes.PATH_TRAVERSAL, message: "File name must be a basename" });
  }

  const root = path.resolve(getBackupDir());
  const resolved = path.resolve(root, fileName);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError({ code: ErrorCodes.PATH_TRAVERSAL, message: "Resolved path escaped backup directory" });
  }
  return resolved;
}

export async function setRestrictiveFileMode(filePath: string) {
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows may not support POSIX modes; ignore.
  }
}

export function createTempDumpPath(prefix: string) {
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(tmpdir(), `${safe}-${Date.now()}-${process.pid}.dump`);
}

export async function safeUnlink(filePath: string | undefined | null) {
  if (!filePath) return;
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}

export function isPathInside(parent: string, child: string) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
