import "server-only";

import { getEnv } from "@/lib/config/env";
import { collectConfigurationIssues, assertBackupAllowedFromIssues, type ConfigIssue } from "@/lib/config/checklist";

export type { ConfigIssue };

export function getConfigurationIssues() {
  return collectConfigurationIssues(getEnv());
}

export function assertBackupAllowed() {
  assertBackupAllowedFromIssues(getConfigurationIssues());
}
