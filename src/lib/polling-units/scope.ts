import { canonicalStateToken, padWardCode } from "./code.ts";

/**
 * Legacy Edo defaults — used only as UX fallbacks (focus state / empty catalog).
 * Geography is nationwide; do not use these to hard-filter PU queries.
 */
export const CAMPAIGN_STATE = "EDO";
export const CAMPAIGN_STATE_CODE = "12";
export const CAMPAIGN_STATE_LABEL = "Edo State";

export const FOCUS_STATE_SETTING_KEY = "campaign_focus_state";

/** Official Edo LGAs (normalized) — kept for historical tests / optional tools. */
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

/** @deprecated Nationwide catalog — identity check only, not a geography gate. */
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

/** @deprecated Prefer any valid PU in the national register. Kept for prune tooling. */
export function isCampaignPollingUnit(unit: {
  state?: string | null;
  state_code?: string | null;
  code?: string | null;
  lga?: string | null;
}): boolean {
  if ((unit.code ?? "").trim()) return true;
  if ((unit.state ?? "").trim()) return true;
  return false;
}

/**
 * No-op for nationwide mode. Call sites that still wrap queries keep compiling;
 * cascade / list screens must filter by selected state / ward instead.
 */
export function applyCampaignStateFilter<T>(query: T): T {
  return query;
}

/** PostgREST-friendly state match for cascade narrowing. */
export function stateMatchOr(state: string): string {
  const trimmed = state.trim().replace(/[%_,()"]/g, "");
  if (!trimmed) return "state.eq.__none__";
  const upper = trimmed.toUpperCase();
  return `state.eq.${trimmed},state.ilike."${trimmed}%",state.eq.${upper}`;
}
