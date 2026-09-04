import { canonicalStateToken, padWardCode } from "./code.ts";

/** Campaign operations are Edo-only until HQ expands the register again. */
export const CAMPAIGN_STATE = "EDO";
export const CAMPAIGN_STATE_CODE = "12";
export const CAMPAIGN_STATE_LABEL = "Edo State";

/** Official Edo LGAs (normalized: lowercase, strip non-alphanumeric). */
export const EDO_CAMPAIGN_LGAS = new Set([
  "akokoedo",
  "egor",
  "esancentral",
  "esannortheast",
  "esansoutheast",
  "esanwest",
  "etsakocentral",
  "etsakoeast",
  "etsakowest",
  "igueben",
  "ikpobaokha",
  "oredo",
  "orhionmwon",
  "ovianortheast",
  "oviasouthwest",
  "owaneast",
  "owanwest",
  "uhunmwonde",
  "uhunmwode",
]);

export function normalizeLgaKey(raw: string | null | undefined): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isEdoCampaignLga(raw: string | null | undefined): boolean {
  return EDO_CAMPAIGN_LGAS.has(normalizeLgaKey(raw));
}

/**
 * PostgREST `or()` for Edo rows.
 * Do not trust bare `state_code=12` or `12/…` codes — national dumps misuse those.
 */
export const CAMPAIGN_STATE_OR = [
  `state.eq.${CAMPAIGN_STATE}`,
  "state.eq.Edo",
  'state.ilike."EDO%"',
  'state.ilike."Edo%"',
  'code.ilike."EDO/%"',
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
  lga?: string | null;
}): boolean {
  if ((unit.state ?? "").toUpperCase().startsWith("EDO")) return true;
  const code = (unit.code ?? "").toUpperCase();
  if (code.startsWith("EDO/")) return true;
  if (isEdoCampaignLga(unit.lga)) return true;
  return false;
}

export function applyCampaignStateFilter<T>(query: T): T {
  return (query as { or: (filters: string) => T }).or(CAMPAIGN_STATE_OR);
}
