import { randomBytes } from "node:crypto";

export function generateBackupFileName(now = new Date(), shortId = createShortId()) {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `weps-backup-${iso}-${shortId}.dump.enc`;
}

export function generateDownloadFileName(createdAt: Date) {
  const iso = createdAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return sanitizeDownloadFileName(`weps-backup-${iso}.dump.enc`);
}

export function sanitizeDownloadFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function createShortId() {
  return randomBytes(4).toString("hex");
}
