import { ErrorCodes } from "@/lib/errors";

export type HealthCheckInput = {
  appDb: boolean;
  diskWritable: boolean;
  pgTools: boolean;
  sourceConnected: boolean;
  sourceIncompatible: boolean;
  blockingIssueCodes: string[];
  timezone: string;
};

export function buildHealthSnapshot(input: HealthCheckInput) {
  const issueCodes = new Set(input.blockingIssueCodes);
  if (!input.appDb) issueCodes.add("APP_DB_UNAVAILABLE");
  if (!input.diskWritable) issueCodes.add("DISK_NOT_WRITABLE");
  if (!input.pgTools) issueCodes.add(ErrorCodes.PG_TOOLS_MISSING);
  if (!input.sourceConnected) issueCodes.add(ErrorCodes.SOURCE_DB_UNREACHABLE);
  if (input.sourceIncompatible) issueCodes.add(ErrorCodes.PG_VERSION_INCOMPATIBLE);

  const backupReady = issueCodes.size === 0;
  return {
    status: backupReady ? "ok" : "degraded",
    app: true,
    appDb: input.appDb,
    diskWritable: input.diskWritable,
    pgTools: input.pgTools,
    sourceDb: input.sourceConnected,
    sourceCompatible: input.sourceConnected && !input.sourceIncompatible,
    backupReady,
    blockingIssueCodes: input.blockingIssueCodes,
    issueCodes: [...issueCodes],
    timezone: input.timezone,
  };
}
