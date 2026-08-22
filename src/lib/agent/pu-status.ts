import type { PollingUnitStatus } from "@/types/database";

export const PU_STATUS_VALUES = [
  "not_active",
  "voting_in_progress",
  "voting_finished",
  "delayed",
  "minor_issue",
  "serious_incident",
  "results_uploaded",
] as const satisfies readonly PollingUnitStatus[];

const PU_STATUSES = new Set<string>(PU_STATUS_VALUES);

export function parsePollingUnitStatus(value: string): PollingUnitStatus | null {
  const status = value.trim();
  return PU_STATUSES.has(status) ? (status as PollingUnitStatus) : null;
}
