import { randomBytes, createHmac, timingSafeEqual } from "crypto";

const COOKIE = "ccc_learn";

export function generateTrainingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function normalizeTrainingCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function secret() {
  return (
    process.env.VOLUNTEER_LEARN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "local-learn-secret"
  );
}

export function signLearnToken(volunteerId: string, tenantId: string, days = 30) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ v: volunteerId, t: tenantId, exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readLearnToken(token: string | undefined | null): { volunteerId: string; tenantId: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      v?: string;
      t?: string;
      exp?: number;
    };
    if (!data.v || !data.t || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { volunteerId: data.v, tenantId: data.t };
  } catch {
    return null;
  }
}

export const LEARN_COOKIE = COOKIE;
