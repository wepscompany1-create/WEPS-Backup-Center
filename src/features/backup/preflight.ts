import { AppError, ErrorCodes } from "@/lib/errors";

export function assertSourceReadyForBackup(source: { connected: boolean; incompatible: boolean }) {
  if (!source.connected) {
    throw new AppError({ code: ErrorCodes.SOURCE_DB_UNREACHABLE });
  }
  if (source.incompatible) {
    throw new AppError({ code: ErrorCodes.PG_VERSION_INCOMPATIBLE });
  }
}
