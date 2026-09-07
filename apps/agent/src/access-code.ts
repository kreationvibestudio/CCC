/** Keep in sync with `src/lib/agent/access-code.ts` (no Node crypto here). */
export const AGENT_CODE_LENGTH = 10;
export const LEGACY_AGENT_CODE_LENGTH = 8;

export function normalizeAgentCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isAgentCodeShape(raw: string) {
  const length = normalizeAgentCode(raw).length;
  return length === AGENT_CODE_LENGTH || length === LEGACY_AGENT_CODE_LENGTH;
}

/**
 * Format as the user types. A finished 8-character code stays XXXX-XXXX;
 * anything else uses the new XXXXX-XXXXX grouping.
 */
export function formatCodeInput(raw: string) {
  const compact = normalizeAgentCode(raw).slice(0, AGENT_CODE_LENGTH);
  if (compact.length <= 5) return compact;
  if (compact.length === LEGACY_AGENT_CODE_LENGTH) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return `${compact.slice(0, 5)}-${compact.slice(5)}`;
}
