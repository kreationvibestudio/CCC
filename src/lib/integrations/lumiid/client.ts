import { normalizeNin, splitPersonName } from "../verifyme/helpers.ts";

const LUMIID_BASE = "https://api.lumiid.com/v1";

/** Official LumiID sandbox NIN persona. */
export const LUMIID_TEST_PERSONA = {
  nin: "89184072280",
  firstname: "Adaeze",
  lastname: "Okonkwo",
  middlename: "Chioma",
  birthdate: "15-04-1992",
  gender: "Female",
  phone: "08000000000",
} as const;

export type LumiIdNinMatch = {
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
  requestId?: string | null;
};

export type LumiIdNinResult = {
  ok: boolean;
  error?: string;
  data?: LumiIdNinMatch;
  demo?: boolean;
};

function resolveSecret(raw = process.env.LUMIID_SECRET_KEY): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  // Reject obviously masked placeholders pasted from dashboards.
  if (!trimmed || /•|\*{4,}|x{6,}/i.test(trimmed)) return null;
  return trimmed;
}

function resolveAppId(raw = process.env.LUMIID_APP_ID): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed || null;
}

export function lumiIdConfigured(secret = process.env.LUMIID_SECRET_KEY): boolean {
  return Boolean(resolveSecret(secret));
}

export function lumiIdDemoModeEnabled(): boolean {
  const flag = (process.env.LUMIID_DEMO_MODE ?? "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

function demoPersonaMatch(input: {
  nin: string;
  firstname: string;
  lastname: string;
}): LumiIdNinResult {
  const expected = LUMIID_TEST_PERSONA;
  if (input.nin !== expected.nin) {
    return {
      ok: false,
      demo: true,
      error:
        "NIN not found (LumiID demo). Use sandbox NIN 89184072280 with name Adaeze Okonkwo.",
    };
  }
  const firstMatch =
    input.firstname.trim().toLowerCase() === expected.firstname.toLowerCase();
  const lastMatch =
    input.lastname.trim().toLowerCase() === expected.lastname.toLowerCase();
  return {
    ok: true,
    demo: true,
    data: {
      nin: expected.nin,
      firstname: expected.firstname,
      lastname: expected.lastname,
      middlename: expected.middlename,
      phone: expected.phone,
      gender: expected.gender,
      birthdate: expected.birthdate,
      photo: null,
      address: "14 Adeola Odeku, Victoria Island, Lagos",
      fieldMatches: { firstname: firstMatch, lastname: lastMatch },
      matchStatus: firstMatch && lastMatch ? "NIN_VERIFIED" : "PARTIAL_MATCH",
    },
  };
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function formatResidence(residence: Record<string, unknown> | null): string | null {
  if (!residence) return null;
  const parts = [
    pickString(residence.address1, residence.address),
    pickString(residence.town),
    pickString(residence.lga),
    pickString(residence.state),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function parseLumiIdNinPayload(
  json: unknown,
  submitted: { firstname: string; lastname: string; dob?: string }
): LumiIdNinMatch | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const nin = String(data.nin ?? data.id_number ?? "").replace(/\D/g, "");
  const firstname = pickString(data.firstname, data.first_name) ?? "";
  const lastname = pickString(data.lastname, data.last_name) ?? "";
  if (!nin || !firstname || !lastname) return null;

  const residence =
    data.residence && typeof data.residence === "object"
      ? (data.residence as Record<string, unknown>)
      : null;
  const meta =
    root.meta && typeof root.meta === "object"
      ? (root.meta as Record<string, unknown>)
      : null;
  const summary =
    root.summary && typeof root.summary === "object"
      ? (root.summary as Record<string, unknown>)
      : null;

  const birthdate = pickString(data.birthdate, data.date_of_birth, data.dob);
  const firstMatch =
    firstname.toLowerCase() === submitted.firstname.trim().toLowerCase();
  const lastMatch =
    lastname.toLowerCase() === submitted.lastname.trim().toLowerCase();
  let dobMatch: boolean | undefined;
  if (submitted.dob && birthdate) {
    const submittedIso = submitted.dob.includes("-")
      ? submitted.dob
      : submitted.dob;
    // Compare loosely: either ISO or DD-MM-YYYY from NIMC.
    const normalizedSubmitted = submittedIso.replace(/\//g, "-");
    const normalizedBirth = birthdate.replace(/\//g, "-");
    dobMatch =
      normalizedSubmitted === normalizedBirth ||
      // YYYY-MM-DD vs DD-MM-YYYY
      (() => {
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedSubmitted);
        const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(normalizedBirth);
        if (iso && dmy) return iso[1] === dmy[3] && iso[2] === dmy[2] && iso[3] === dmy[1];
        return false;
      })();
  }

  return {
    nin,
    firstname,
    lastname,
    middlename: pickString(data.middlename, data.middle_name),
    phone: pickString(data.phone, data.phone_number),
    gender: pickString(data.gender),
    birthdate,
    photo: pickString(data.photo),
    address:
      pickString(data.address) ??
      formatResidence(residence) ??
      null,
    fieldMatches: {
      firstname: firstMatch,
      lastname: lastMatch,
      dob: dobMatch,
    },
    matchStatus:
      pickString(root.code, summary?.verified === true ? "NIN_VERIFIED" : null) ??
      null,
    requestId: pickString(meta?.request_id),
  };
}

/**
 * Verify a NIN via LumiID Basic.
 * Docs: POST https://api.lumiid.com/v1/ng/nin-basic/
 * Auth: Authorization: Bearer <secret> (+ optional X-App-ID)
 */
export async function verifyNinWithLumiId(input: {
  nin: string;
  firstname: string;
  lastname: string;
  dob?: string;
}): Promise<LumiIdNinResult> {
  const nin = normalizeNin(input.nin);
  if (!nin) return { ok: false, error: "NIN must be 11 digits" };
  const firstname = input.firstname.trim();
  const lastname = input.lastname.trim();
  if (firstname.length < 1 || lastname.length < 1) {
    return { ok: false, error: "First and last name are required for NIN verification" };
  }

  const secret = resolveSecret();
  if (!secret) {
    if (lumiIdDemoModeEnabled() || process.env.NODE_ENV !== "production") {
      return demoPersonaMatch({ nin, firstname, lastname });
    }
    return {
      ok: false,
      error:
        "LUMIID_SECRET_KEY is not set. Add your LumiID live/sandbox secret key in Vercel / .env.local.",
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const appId = resolveAppId();
  if (appId) headers["X-App-ID"] = appId;

  try {
    const res = await fetch(`${LUMIID_BASE}/ng/nin-basic/`, {
      method: "POST",
      headers,
      // Docs vary between `nin` and `id_number` — send both.
      body: JSON.stringify({ nin, id_number: nin }),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const root =
      json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const code = root?.code != null ? String(root.code) : "";
    const detail = root?.detail != null ? String(root.detail) : "";
    const message =
      (root?.message != null ? String(root.message) : "") || detail;

    if (
      res.status === 401 ||
      code === "INVALID_API_KEY" ||
      /invalid or inactive api key/i.test(message)
    ) {
      return {
        ok: false,
        error:
          "LumiID API key is invalid or inactive. Paste a fresh Secret Key into Vercel as LUMIID_SECRET_KEY and redeploy.",
      };
    }
    if (
      res.status === 402 ||
      code === "INSUFFICIENT_CREDITS" ||
      code === "INSUFFICIENT_FUNDS"
    ) {
      return {
        ok: false,
        error:
          message ||
          "LumiID wallet has insufficient funds. Top up your wallet in the LumiID console, then retry Verify NIN.",
      };
    }
    if (code === "SUBSCRIPTION_REQUIRED") {
      return {
        ok: false,
        error:
          message ||
          "LumiID NIN product is not enabled on this account. Enable NIN Verification in the LumiID console.",
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          message ||
          "LumiID rejected the request (403). Check the API key, wallet, and that NIN Verification is enabled.",
      };
    }
    if (
      code === "NIN_NOT_FOUND" ||
      /identity record not found/i.test(message) ||
      /nin.?not.?found/i.test(message)
    ) {
      return {
        ok: false,
        error:
          "No NIMC record for that NIN. Re-check all 11 digits. Live keys only work with real NINs — sandbox test NIN 89184072280 needs a sandbox Secret Key.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: message || `LumiID returned HTTP ${res.status}`,
      };
    }

    const summaryVerified =
      root?.summary &&
      typeof root.summary === "object" &&
      (root.summary as { verified?: unknown }).verified === true;
    const successFlag = root && "success" in root ? Boolean(root.success) : true;
    if (code && code !== "NIN_VERIFIED" && !summaryVerified) {
      return {
        ok: false,
        error: message || `LumiID NIN verification failed (${code})`,
      };
    }
    if (!successFlag && !summaryVerified) {
      return {
        ok: false,
        error: message || "LumiID NIN verification failed",
      };
    }

    const data = parseLumiIdNinPayload(json, {
      firstname,
      lastname,
      dob: input.dob,
    });
    if (!data) {
      return { ok: false, error: "LumiID returned an unexpected NIN response" };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach LumiID",
    };
  }
}

export function sanitizeLumiIdNinForStorage(
  match: LumiIdNinMatch,
  meta?: { demo?: boolean }
): Record<string, unknown> {
  const rawPhoto = (match.photo ?? "").trim();
  const hasPhoto = rawPhoto.length > 20;
  const photo = hasPhoto && rawPhoto.length <= 180_000 ? rawPhoto : null;
  return {
    provider: "lumiid",
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
    request_id: match.requestId ?? null,
    has_photo: hasPhoto,
    photo,
    verified_at: new Date().toISOString(),
  };
}

export { normalizeNin, splitPersonName };
