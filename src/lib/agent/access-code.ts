import { createHash, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function normalizeAgentCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatAgentCode(normalized: string) {
  const compact = normalizeAgentCode(normalized);
  if (compact.length !== 8) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function generateAgentCode() {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return formatAgentCode(out);
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
  return normalizeAgentCode(raw).length === 8;
}

export function validateAgentCodeLogin(input: { code: string; latitude: number; longitude: number }) {
  if (!isAgentCodeShape(input.code)) {
    return "Enter the 8-character agent code HQ gave you";
  }
  if (!Number.isFinite(Number(input.latitude)) || !Number.isFinite(Number(input.longitude))) {
    return "Turn on location so we can confirm you are at your polling unit";
  }
  return null;
}
