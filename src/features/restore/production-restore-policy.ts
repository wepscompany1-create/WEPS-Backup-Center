import type { ProductionRestoreStatus } from "@prisma/client";
import { ErrorCodes, sanitizeErrorMessage } from "@/lib/errors";

export function isCutoverEligibleStatus(status: ProductionRestoreStatus) {
  return status === "AWAITING_CUTOVER" || status === "AWAITING_EXTERNAL_CUTOVER";
}

export function productionRestoreActions(restore: {
  status: ProductionRestoreStatus;
  validationCompleted: boolean;
  cutoverCompleted: boolean;
  rollbackAvailableUntil: Date | null;
  previousDatabaseName: string | null;
  previousDroppedAt: Date | null;
}) {
  return {
    canCutover: isCutoverEligibleStatus(restore.status) && restore.validationCompleted,
    canDropPrevious:
      restore.status === "SUCCESS" &&
      restore.cutoverCompleted &&
      Boolean(restore.previousDatabaseName) &&
      !restore.previousDroppedAt &&
      Boolean(restore.rollbackAvailableUntil && restore.rollbackAvailableUntil <= new Date()),
  };
}

export function classifyRenameFailure(stderr: string) {
  const safe = sanitizeErrorMessage(stderr).toLowerCase();
  return safe.includes("permission") || safe.includes("must be owner")
    ? ErrorCodes.CUTOVER_PERMISSION_DENIED
    : ErrorCodes.CUTOVER_ACTIVE_CONNECTIONS;
}

export function shouldMarkExternalCutover(code: string) {
  return code === ErrorCodes.CUTOVER_PERMISSION_DENIED;
}
