import { canonicalStateToken, padWardCode } from "./code.ts";

/** Campaign operations are Edo-only until HQ expands the register again. */
export const CAMPAIGN_STATE = "EDO";
export const CAMPAIGN_STATE_CODE = "12";
export const CAMPAIGN_STATE_LABEL = "Edo State";

/** PostgREST `or()` that keeps Edo rows regardless of casing or numeric state code. */
export const CAMPAIGN_STATE_OR = [
  `state.eq.${CAMPAIGN_STATE}`,
  "state.eq.Edo",
  'state.ilike."EDO%"',
  'state.ilike."Edo%"',
  `state_code.eq.${CAMPAIGN_STATE_CODE}`,
].join(",");

export function isCampaignState(raw: string | null | undefined): boolean {
  const token = canonicalStateToken(raw);
  if (token === CAMPAIGN_STATE) return true;
  return padWardCode(raw) === CAMPAIGN_STATE_CODE;
}

export function isCampaignPollingUnit(unit: {
  state?: string | null;
  state_code?: string | null;
  code?: string | null;
}): boolean {
  if (isCampaignState(unit.state) || isCampaignState(unit.state_code)) return true;
  const code = (unit.code ?? "").toUpperCase();
  if (code.startsWith("EDO/") || code.startsWith("12/")) return true;
  return false;
}

export function applyCampaignStateFilter<T>(query: T): T {
  return (query as { or: (filters: string) => T }).or(CAMPAIGN_STATE_OR);
}
