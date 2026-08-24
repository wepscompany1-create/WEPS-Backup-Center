export function serializeBackup(backup: {
  id: string;
  backupNumber: number;
  type: string;
  status: string;
  progressStage: string | null;
  integrityStatus: string;
  fileName: string | null;
  originalDumpSizeBytes: bigint | null;
  encryptedSizeBytes: bigint | null;
  sha256: string | null;
  pgDumpVersion: string | null;
  postgresServerVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorReferenceId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  initiatedBy?: { email: string } | null;
}) {
  return {
    ...backup,
    originalDumpSizeBytes: backup.originalDumpSizeBytes?.toString() ?? null,
    encryptedSizeBytes: backup.encryptedSizeBytes?.toString() ?? null,
  };
}
