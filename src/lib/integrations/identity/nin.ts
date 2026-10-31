import {
  qoreIdConfigured,
  sanitizeQoreIdNinForStorage,
  verifyNinWithQoreId,
} from "@/lib/integrations/qoreid/client";
import {
  sanitizeNinVerificationForStorage,
  verifyMeConfigured,
  verifyMeDemoModeEnabled,
  verifyNinIdentity as verifyNinWithVerifyMe,
  type VerifyMeNinMatch,
} from "@/lib/integrations/verifyme/client";
import { toIsoDob } from "@/lib/integrations/verifyme/helpers";

export type NinMatch = {
  nin: string;
  firstname: string;
  lastname: string;
  middlename?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  photo?: string | null;
  address?: string | null;
  fieldMatches?: VerifyMeNinMatch["fieldMatches"];
  matchStatus?: string | null;
};

export type NinVerifyResult = {
  ok: boolean;
  error?: string;
  data?: NinMatch;
  demo?: boolean;
  provider?: "qoreid" | "verifyme" | "demo";
  storage?: Record<string, unknown>;
};

export function ninProviderStatus(): {
  provider: "qoreid" | "verifyme" | "demo";
  configured: boolean;
  demoMode: boolean;
} {
  if (qoreIdConfigured()) {
    return { provider: "qoreid", configured: true, demoMode: false };
  }
  if (verifyMeConfigured()) {
    return { provider: "verifyme", configured: true, demoMode: false };
  }
  const demo =
    verifyMeDemoModeEnabled() ||
    process.env.NODE_ENV !== "production" ||
    (process.env.QOREID_DEMO_MODE ?? "").toLowerCase() === "true";
  return { provider: "demo", configured: false, demoMode: demo };
}

/** Prefer QoreID when credentials exist; otherwise VerifyMe / local demo. */
export async function verifyNinIdentityUnified(input: {
  nin: string;
  firstname: string;
  lastname: string;
  dob: string;
  phone?: string;
}): Promise<NinVerifyResult> {
  if (!toIsoDob(input.dob)) {
    return { ok: false, error: "Enter a valid date of birth before verifying NIN" };
  }

  if (qoreIdConfigured()) {
    const result = await verifyNinWithQoreId(input);
    if (!result.ok || !result.data) {
      return { ok: false, error: result.error ?? "QoreID NIN verification failed", provider: "qoreid" };
    }
    return {
      ok: true,
      data: result.data,
      demo: result.demo,
      provider: "qoreid",
      storage: sanitizeQoreIdNinForStorage(result.data, { demo: result.demo }),
    };
  }

  const result = await verifyNinWithVerifyMe(input);
  if (!result.ok || !result.data) {
    return {
      ok: false,
      error: result.error ?? "NIN verification failed",
      provider: result.demo ? "demo" : "verifyme",
    };
  }
  return {
    ok: true,
    data: result.data,
    demo: result.demo,
    provider: result.demo ? "demo" : "verifyme",
    storage: sanitizeNinVerificationForStorage(result.data, { demo: result.demo }),
  };
}
