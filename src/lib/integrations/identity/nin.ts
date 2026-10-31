import {
  lumiIdConfigured,
  lumiIdDemoModeEnabled,
  sanitizeLumiIdNinForStorage,
  verifyNinWithLumiId,
} from "@/lib/integrations/lumiid/client";
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

export type NinProvider = "lumiid" | "qoreid" | "verifyme" | "demo";

export type NinVerifyResult = {
  ok: boolean;
  error?: string;
  data?: NinMatch;
  demo?: boolean;
  provider?: NinProvider;
  storage?: Record<string, unknown>;
};

export function ninProviderStatus(): {
  provider: NinProvider;
  configured: boolean;
  demoMode: boolean;
} {
  if (lumiIdConfigured()) {
    return { provider: "lumiid", configured: true, demoMode: false };
  }
  if (qoreIdConfigured()) {
    return { provider: "qoreid", configured: true, demoMode: false };
  }
  if (verifyMeConfigured()) {
    return { provider: "verifyme", configured: true, demoMode: false };
  }
  const demo =
    lumiIdDemoModeEnabled() ||
    verifyMeDemoModeEnabled() ||
    process.env.NODE_ENV !== "production" ||
    (process.env.QOREID_DEMO_MODE ?? "").toLowerCase() === "true";
  return { provider: "demo", configured: false, demoMode: demo };
}

/** Prefer LumiID when credentials exist; then QoreID / VerifyMe / local demo. */
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

  if (lumiIdConfigured()) {
    const result = await verifyNinWithLumiId(input);
    if (!result.ok || !result.data) {
      return {
        ok: false,
        error: result.error ?? "LumiID NIN verification failed",
        provider: "lumiid",
      };
    }
    return {
      ok: true,
      data: result.data,
      demo: result.demo,
      provider: "lumiid",
      storage: sanitizeLumiIdNinForStorage(result.data, { demo: result.demo }),
    };
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

  if (
    verifyMeConfigured() ||
    verifyMeDemoModeEnabled() ||
    lumiIdDemoModeEnabled() ||
    process.env.NODE_ENV !== "production"
  ) {
    if (lumiIdDemoModeEnabled() && !verifyMeConfigured()) {
      const result = await verifyNinWithLumiId(input);
      if (!result.ok || !result.data) {
        return {
          ok: false,
          error: result.error ?? "LumiID demo NIN verification failed",
          provider: "demo",
        };
      }
      return {
        ok: true,
        data: result.data,
        demo: true,
        provider: "demo",
        storage: sanitizeLumiIdNinForStorage(result.data, { demo: true }),
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

  return {
    ok: false,
    provider: "demo",
    error:
      "NIN verification is not configured. Add LUMIID_SECRET_KEY (preferred) in Vercel / .env.local, then redeploy. Optionally set LUMIID_APP_ID if your LumiID dashboard requires it.",
  };
}
