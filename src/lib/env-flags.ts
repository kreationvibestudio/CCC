const TRUTHY = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSY = new Set(["0", "false", "no", "off", "disabled"]);

/**
 * Parse a boolean environment flag. Anything unset or unrecognised falls back to
 * `fallback`, so a typo in a hosting dashboard can never silently flip a
 * security default open.
 */
export function isEnvFlagEnabled(raw: string | undefined, fallback = false): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return fallback;
}
