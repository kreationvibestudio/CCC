import {
  normalizeNin,
  splitPersonName,
  toIsoDob,
} from "../verifyme/helpers.ts";

const QOREID_BASE = "https://api.qoreid.com";

/** Official QoreID sandbox NIN personas (test keys). */
export const QOREID_TEST_PERSONAS = [
  {
    nin: "63184876213",
    firstname: "Bunch",
    lastname: "Dillon",
    phone: "08000000000",
    birthdate: "06-01-1974",
  },
  {
    nin: "18482561982",
    firstname: "Guion",
    lastname: "Audi",
    phone: "08000000001",
  },
] as const;

export type QoreIdNinMatch = {
  nin: string;
  firstname: string;
  lastname: string;
  middlename?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  photo?: string | null;
  address?: string | null;
  fieldMatches?: {
    firstname?: boolean;
    lastname?: boolean;
    dob?: boolean;
  };
  matchStatus?: string | null;
};

export type QoreIdNinResult = {
  ok: boolean;
  error?: string;
  data?: QoreIdNinMatch;
  /** true when local sandbox persona simulation was used */
  demo?: boolean;
};

type CachedToken = { accessToken: string; expiresAtMs: number };
let cachedToken: CachedToken | null = null;

function resolveClientId(raw = process.env.QOREID_CLIENT_ID): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed || null;
}

function resolveSecret(raw = process.env.QOREID_SECRET_KEY): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed || null;
}

export function qoreIdConfigured(
  clientId = process.env.QOREID_CLIENT_ID,
  secret = process.env.QOREID_SECRET_KEY
): boolean {
  return Boolean(resolveClientId(clientId) && resolveSecret(secret));
}

export function qoreIdDemoModeEnabled(): boolean {
  const flag = (process.env.QOREID_DEMO_MODE ?? "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

async function mintAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = resolveClientId();
  const secret = resolveSecret();
  if (!clientId || !secret) {
    return {
      error:
        "QOREID_CLIENT_ID and QOREID_SECRET_KEY are not set. Add them in Vercel / .env.local.",
    };
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) {
    return { token: cachedToken.accessToken };
  }

  try {
    const res = await fetch(`${QOREID_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ clientId, secret }),
      cache: "no-store",
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    if (!res.ok || !json?.accessToken) {
      const msg =
        json && typeof json.message === "string"
          ? json.message
          : `QoreID token request failed (HTTP ${res.status})`;
      return { error: msg };
    }
    const expiresRaw = String(json.expiresIn ?? "7200");
    const expiresSecs = Number.parseInt(expiresRaw.replace(/[^\d]/g, ""), 10) || 7200;
    cachedToken = {
      accessToken: String(json.accessToken),
      expiresAtMs: now + expiresSecs * 1000,
    };
    return { token: cachedToken.accessToken };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reach QoreID token endpoint",
    };
  }
}

function demoPersonaMatch(input: {
  nin: string;
  firstname: string;
  lastname: string;
}): QoreIdNinResult {
  const persona = QOREID_TEST_PERSONAS.find((p) => p.nin === input.nin);
  if (!persona) {
    return {
      ok: false,
      demo: true,
      error:
        "NIN not found (QoreID demo). Use test persona NIN 63184876213 with name Bunch Dillon.",
    };
  }
  const firstMatch =
    input.firstname.trim().toLowerCase() === persona.firstname.toLowerCase();
  const lastMatch =
    input.lastname.trim().toLowerCase() === persona.lastname.toLowerCase();
  return {
    ok: true,
    demo: true,
    data: {
      nin: persona.nin,
      firstname: persona.firstname,
      lastname: persona.lastname,
      middlename: "John",
      phone: persona.phone,
      gender: "m",
      birthdate: "birthdate" in persona ? persona.birthdate : null,
      photo: null,
      address: "5, Adeniyi Jones, Ikeja, Lagos",
      fieldMatches: { firstname: firstMatch, lastname: lastMatch },
      matchStatus: firstMatch && lastMatch ? "EXACT_MATCH" : "PARTIAL_MATCH",
    },
  };
}

function parseQoreIdNinPayload(json: unknown): QoreIdNinMatch | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const ninObj =
    root.nin && typeof root.nin === "object"
      ? (root.nin as Record<string, unknown>)
      : null;
  if (!ninObj) return null;
  const nin = String(ninObj.nin ?? "").replace(/\D/g, "");
  const firstname = String(ninObj.firstname ?? "").trim();
  const lastname = String(ninObj.lastname ?? "").trim();
  if (!nin || !firstname || !lastname) return null;

  const summary =
    root.summary && typeof root.summary === "object"
      ? (root.summary as Record<string, unknown>)
      : null;
  const ninCheck =
    summary?.nin_check && typeof summary.nin_check === "object"
      ? (summary.nin_check as Record<string, unknown>)
      : null;
  const matches =
    ninCheck?.fieldMatches && typeof ninCheck.fieldMatches === "object"
      ? (ninCheck.fieldMatches as Record<string, unknown>)
      : null;

  return {
    nin,
    firstname,
    lastname,
    middlename: ninObj.middlename != null ? String(ninObj.middlename) : null,
    phone: ninObj.phone != null ? String(ninObj.phone) : null,
    gender: ninObj.gender != null ? String(ninObj.gender) : null,
    birthdate: ninObj.birthdate != null ? String(ninObj.birthdate) : null,
    photo: ninObj.photo != null ? String(ninObj.photo) : null,
    address: ninObj.address != null ? String(ninObj.address) : null,
    fieldMatches: matches
      ? {
          firstname: Boolean(matches.firstname),
          lastname: Boolean(matches.lastname),
          dob: Boolean(matches.dob),
        }
      : undefined,
    matchStatus: ninCheck?.status != null ? String(ninCheck.status) : null,
  };
}

/**
 * Verify a NIN via QoreID.
 * Docs: POST https://api.qoreid.com/v1/ng/identities/nin/{idNumber}
 * Auth: Bearer token from POST https://api.qoreid.com/token
 */
export async function verifyNinWithQoreId(input: {
  nin: string;
  firstname: string;
  lastname: string;
  dob?: string;
  phone?: string;
}): Promise<QoreIdNinResult> {
  const nin = normalizeNin(input.nin);
  if (!nin) return { ok: false, error: "NIN must be 11 digits" };
  const firstname = input.firstname.trim();
  const lastname = input.lastname.trim();
  if (firstname.length < 1 || lastname.length < 1) {
    return { ok: false, error: "First and last name are required for NIN verification" };
  }

  if (!qoreIdConfigured()) {
    if (qoreIdDemoModeEnabled() || process.env.NODE_ENV !== "production") {
      return demoPersonaMatch({ nin, firstname, lastname });
    }
    return {
      ok: false,
      error: "QOREID_CLIENT_ID and QOREID_SECRET_KEY are not set.",
    };
  }

  const minted = await mintAccessToken();
  if (!minted.token) return { ok: false, error: minted.error ?? "QoreID auth failed" };

  const dobIso = input.dob ? toIsoDob(input.dob) : null;
  const payload: Record<string, string> = { firstname, lastname };
  if (dobIso) payload.dob = dobIso;
  if (input.phone?.trim()) payload.phone = input.phone.trim();

  try {
    const res = await fetch(
      `${QOREID_BASE}/v1/ng/identities/nin/${encodeURIComponent(nin)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${minted.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (res.status === 403) {
      return {
        ok: false,
        error:
          "QoreID credentials are valid but this account is not subscribed to the NIN product. Enable NIN in the QoreID dashboard (test keys still need the NIN product turned on).",
      };
    }
    if (res.status === 401) {
      cachedToken = null;
      return { ok: false, error: "QoreID unauthorized — check client id and secret key" };
    }
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : `QoreID returned HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    const data = parseQoreIdNinPayload(json);
    if (!data) return { ok: false, error: "QoreID returned an unexpected NIN response" };
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach QoreID",
    };
  }
}

export function sanitizeQoreIdNinForStorage(
  match: QoreIdNinMatch,
  meta?: { demo?: boolean }
): Record<string, unknown> {
  const rawPhoto = (match.photo ?? "").trim();
  const hasPhoto = rawPhoto.length > 20;
  const photo = hasPhoto && rawPhoto.length <= 180_000 ? rawPhoto : null;
  return {
    provider: "qoreid",
    demo: Boolean(meta?.demo),
    nin: match.nin,
    firstname: match.firstname,
    lastname: match.lastname,
    middlename: match.middlename ?? null,
    phone: match.phone ?? null,
    gender: match.gender ?? null,
    birthdate: match.birthdate ?? null,
    address: match.address ?? null,
    fieldMatches: match.fieldMatches ?? null,
    match_status: match.matchStatus ?? null,
    has_photo: hasPhoto,
    photo,
    verified_at: new Date().toISOString(),
  };
}

export { normalizeNin, splitPersonName };
