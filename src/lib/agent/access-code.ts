import { createHash, randomBytes } from "crypto";

/** Crockford-style alphabet: no O/I/L/U/0/1 to survive being read aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** Codes issued from now on. */
export const AGENT_CODE_LENGTH = 10;
/** Codes issued before the length change stay usable until they are reissued. */
export const LEGACY_AGENT_CODE_LENGTH = 8;

/** How long a freshly issued code stays valid. */
export const AGENT_CODE_TTL_DAYS = 90;

export function normalizeAgentCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatAgentCode(normalized: string) {
  const compact = normalizeAgentCode(normalized);
  if (compact.length !== AGENT_CODE_LENGTH && compact.length !== LEGACY_AGENT_CODE_LENGTH) {
    return compact;
  }
  const half = compact.length / 2;
  return `${compact.slice(0, half)}-${compact.slice(half)}`;
}

/**
 * Draw `length` characters uniformly from ALPHABET.
 *
 * `bytes[i] % 30` is biased: 256 is not a multiple of 30, so the first 16
 * letters come up slightly more often. Rejection sampling removes the bias and
 * keeps the full search space.
 */
function randomCodeChars(length: number) {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function generateAgentCode() {
  return formatAgentCode(randomCodeChars(AGENT_CODE_LENGTH));
}

export function hashAgentCode(raw: string) {
  const normalized = normalizeAgentCode(raw);
  return createHash("sha256").update(`ccc.agent.v1:${normalized}`).digest("hex");
}

export function agentCodeHint(formatted: string) {
  const compact = normalizeAgentCode(formatted);
  return compact.slice(-4);
}

export function isAgentCodeShape(raw: string) {
  const length = normalizeAgentCode(raw).length;
  return length === AGENT_CODE_LENGTH || length === LEGACY_AGENT_CODE_LENGTH;
}

export function agentCodeExpiry(from = new Date()) {
  return new Date(from.getTime() + AGENT_CODE_TTL_DAYS * 86400000);
}

export function isAgentCodeExpired(expiresAt: string | null | undefined, now = new Date()) {
  if (!expiresAt) return false;
  const at = new Date(expiresAt).getTime();
  if (Number.isNaN(at)) return false;
  return at <= now.getTime();
}

export function validateAgentCodeLogin(input: {
  code: string;
  latitude?: number | null;
  longitude?: number | null;
  requireGps?: boolean;
}) {
  if (!isAgentCodeShape(input.code)) {
    return `Enter the ${AGENT_CODE_LENGTH}-character agent code HQ gave you`;
  }
  if (input.requireGps) {
    if (!Number.isFinite(Number(input.latitude)) || !Number.isFinite(Number(input.longitude))) {
      return "Turn on location so we can confirm you are at your polling unit";
    }
  }
  return null;
}
