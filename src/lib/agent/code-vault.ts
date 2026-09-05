import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { normalizeAgentCode, isAgentCodeShape } from "./access-code.ts";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Key for encrypting stored agent codes at rest.
 *
 * Prefers an explicit AGENT_CODE_ENCRYPTION_KEY (32 bytes, hex or base64).
 * Falls back to a key derived from the service-role key so existing
 * deployments get encryption without new configuration. The threat model is a
 * database leak: a dump alone is useless without the server environment.
 *
 * Rotating the source secret makes stored codes undecryptable, which shows in
 * HQ as "reissue to view" rather than as a broken page.
 */
function encryptionKey(): Buffer | null {
  const explicit = process.env.AGENT_CODE_ENCRYPTION_KEY?.trim();
  if (explicit) {
    const decoded = decodeKey(explicit);
    if (decoded) return decoded;
  }
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!seed) return null;
  return Buffer.from(hkdfSync("sha256", seed, "ccc.agent.code.v1", "agent-access-code", 32));
}

function decodeKey(raw: string): Buffer | null {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Encrypt a code for storage. Returns null when no key is available, and the
 * caller then stores nothing rather than falling back to plaintext.
 */
export function encryptAgentCode(code: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeAgentCode(code), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Decrypt a stored code. Values written before encryption was introduced are
 * bare codes and are returned as-is so HQ keeps working until they are reissued.
 */
export function decryptAgentCode(stored: string | null | undefined): string | null {
  const value = stored?.trim();
  if (!value) return null;

  if (!value.startsWith(`${PREFIX}:`)) {
    return isAgentCodeShape(value) ? value : null;
  }

  const key = encryptionKey();
  if (!key) return null;

  const [, ivB64, tagB64, dataB64] = value.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return isAgentCodeShape(plain) ? plain : null;
  } catch {
    return null;
  }
}

export function isEncryptedAgentCode(stored: string | null | undefined) {
  return Boolean(stored?.trim().startsWith(`${PREFIX}:`));
}
