import {
  normalizeNin,
  toVerifyMeDob,
  VERIFYME_TEST_PERSONA,
} from "./helpers.ts";

export {
  normalizeNin,
  photoDataUrl,
  splitPersonName,
  toVerifyMeDob,
  VERIFYME_TEST_PERSONA,
} from "./helpers.ts";

const VERIFYME_BASE = "https://vapi.verifyme.ng/v1";

export type VerifyMeNinMatch = {
  nin: string;
  firstname: string;
  lastname: string;
  middlename?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  photo?: string | null;
  fieldMatches?: {
    firstname?: boolean;
    lastname?: boolean;
    dob?: boolean;
  };
};

export type VerifyMeNinResult = {
  ok: boolean;
  error?: string;
  data?: VerifyMeNinMatch;
  /** true when VERIFYME_DEMO_MODE or missing key used the local John Doe persona */
  demo?: boolean;
};

function resolveVerifyMeApiKey(raw = process.env.VERIFYME_API_KEY): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed || null;
}

export function verifyMeConfigured(raw = process.env.VERIFYME_API_KEY): boolean {
  return Boolean(resolveVerifyMeApiKey(raw));
}

export function verifyMeDemoModeEnabled(): boolean {
  const flag = (process.env.VERIFYME_DEMO_MODE ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  // Local/dev convenience: allow the sandbox persona when no key is set.
  if (!resolveVerifyMeApiKey() && process.env.NODE_ENV !== "production") return true;
  return false;
}

function demoPersonaMatch(input: {
  nin: string;
  firstname: string;
  lastname: string;
  dob: string;
}): VerifyMeNinResult {
  const expected = VERIFYME_TEST_PERSONA;
  const ninOk = input.nin === expected.nin;
  if (!ninOk) {
    return {
      ok: false,
      demo: true,
      error:
        "NIN not found (demo). Use test persona NIN 10000000001 with name John Doe and DOB 04-04-1944.",
    };
  }
  const firstMatch =
    input.firstname.trim().toLowerCase() === expected.firstname.toLowerCase();
  const lastMatch =
    input.lastname.trim().toLowerCase() === expected.lastname.toLowerCase();
  const dobMatch = input.dob === expected.dob;
  // 1×1 grey JPEG placeholder (valid data URL consumers can render).
  const photo =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

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
      photo,
      fieldMatches: {
        firstname: firstMatch,
        lastname: lastMatch,
        dob: dobMatch,
      },
    },
  };
}

function parseVerifyMePayload(json: unknown): VerifyMeNinMatch | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const nin = String(data.nin ?? "").replace(/\D/g, "");
  const firstname = String(data.firstname ?? data.firstName ?? "").trim();
  const lastname = String(data.lastname ?? data.lastName ?? "").trim();
  if (!nin || !firstname || !lastname) return null;
  const matches =
    data.fieldMatches && typeof data.fieldMatches === "object"
      ? (data.fieldMatches as Record<string, unknown>)
      : null;
  return {
    nin,
    firstname,
    lastname,
    middlename: data.middlename != null ? String(data.middlename) : null,
    phone: data.phone != null ? String(data.phone) : null,
    gender: data.gender != null ? String(data.gender) : null,
    birthdate: data.birthdate != null ? String(data.birthdate) : null,
    photo: data.photo != null ? String(data.photo) : null,
    fieldMatches: matches
      ? {
          firstname: Boolean(matches.firstname ?? matches.firsname),
          lastname: Boolean(matches.lastname),
          dob: Boolean(matches.dob),
        }
      : undefined,
  };
}

/**
 * Verify a NIN via VerifyMe.
 * Docs: POST https://vapi.verifyme.ng/v1/verifications/identities/nin/:ref
 */
export async function verifyNinIdentity(input: {
  nin: string;
  firstname: string;
  lastname: string;
  dob: string;
}): Promise<VerifyMeNinResult> {
  const nin = normalizeNin(input.nin);
  if (!nin) return { ok: false, error: "NIN must be 11 digits" };
  const dob = toVerifyMeDob(input.dob);
  if (!dob) return { ok: false, error: "Date of birth must be a valid date (YYYY-MM-DD)" };
  const firstname = input.firstname.trim();
  const lastname = input.lastname.trim();
  if (firstname.length < 1 || lastname.length < 1) {
    return { ok: false, error: "First and last name are required for NIN verification" };
  }

  const apiKey = resolveVerifyMeApiKey();
  if (!apiKey) {
    if (verifyMeDemoModeEnabled()) {
      return demoPersonaMatch({ nin, firstname, lastname, dob });
    }
    return {
      ok: false,
      error:
        "VERIFYME_API_KEY is not set. Add it in Vercel / .env.local, or set VERIFYME_DEMO_MODE=true for the John Doe test persona.",
    };
  }

  try {
    const res = await fetch(`${VERIFYME_BASE}/verifications/identities/nin/${encodeURIComponent(nin)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ firstname, lastname, dob }),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (res.status === 404) {
      const msg =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : "NIN provided is not found. Please provide a valid NIN.";
      return { ok: false, error: msg };
    }

    if (!res.ok) {
      const msg =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : `VerifyMe returned HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    const data = parseVerifyMePayload(json);
    if (!data) return { ok: false, error: "VerifyMe returned an unexpected response" };
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach VerifyMe",
    };
  }
}

const MAX_STORED_PHOTO_CHARS = 180_000;

/** Persistable VerifyMe subset. Keeps photo when under size cap for HQ security review. */
export function sanitizeNinVerificationForStorage(
  match: VerifyMeNinMatch,
  meta?: { demo?: boolean }
): Record<string, unknown> {
  const rawPhoto = (match.photo ?? "").trim();
  const hasPhoto = rawPhoto.length > 20;
  const photo =
    hasPhoto && rawPhoto.length <= MAX_STORED_PHOTO_CHARS ? rawPhoto : null;
  return {
    provider: "verifyme",
    demo: Boolean(meta?.demo),
    nin: match.nin,
    firstname: match.firstname,
    lastname: match.lastname,
    middlename: match.middlename ?? null,
    phone: match.phone ?? null,
    gender: match.gender ?? null,
    birthdate: match.birthdate ?? null,
    fieldMatches: match.fieldMatches ?? null,
    has_photo: hasPhoto,
    photo,
    verified_at: new Date().toISOString(),
  };
}
