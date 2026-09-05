import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { adminGenerateMagicLink } from "@/lib/auth/admin-users";
import {
  formatAgentCode,
  generateAgentCode,
  hashAgentCode,
  normalizeAgentCode,
  agentCodeHint,
  agentCodeExpiry,
  isAgentCodeExpired,
  validateAgentCodeLogin,
} from "@/lib/agent/access-code";
import { encryptAgentCode } from "@/lib/agent/code-vault";
import { checkRateLimit } from "@/lib/rate-limit";
import { AGENT_LOGIN_RADIUS_M, haversineMeters, isAgentSoftGpsEnabled, isWithinAgentLoginRadius } from "@/lib/agent/geo";
import { isMissingRelationError } from "@/lib/public-error";
import { formatPollingUnitCode } from "@/lib/polling-units/code";

export { AGENT_LOGIN_RADIUS_M };

function retryLabel(seconds: number) {
  if (seconds >= 120) return `${Math.ceil(seconds / 60)} minutes`;
  if (seconds > 60) return "a minute";
  return `${Math.max(1, seconds)} seconds`;
}

type IssueInput = {
  tenantId: string;
  profileId: string;
  pollingUnitId: string;
};

export async function issueAgentAccessCode(input: IssueInput): Promise<{ code?: string; hint?: string; error?: string }> {
  const admin = createServiceClient();
  await admin
    .from("agent_access_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", input.profileId)
    .is("revoked_at", null);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateAgentCode();
    const { error } = await admin.from("agent_access_codes").insert({
      tenant_id: input.tenantId,
      profile_id: input.profileId,
      polling_unit_id: input.pollingUnitId,
      code_hash: hashAgentCode(code),
      code_hint: agentCodeHint(code),
      // Encrypted at rest: a database dump alone must not yield working logins.
      code_display: encryptAgentCode(code),
      expires_at: agentCodeExpiry().toISOString(),
    });
    if (!error) return { code, hint: agentCodeHint(code) };
    if (isMissingRelationError(error.message, "agent_access_codes")) {
      return { error: "Agent codes need the latest database SQL. Run 20260823000003_agent_access_codes.sql and 20260823000004_agent_access_code_display.sql in Supabase." };
    }
    if (/code_display/i.test(error.message) && /column|schema cache|pgrst/i.test(error.message)) {
      return { error: "Agent codes need the latest database SQL. Run 20260823000004_agent_access_code_display.sql in Supabase." };
    }
    if (/expires_at/i.test(error.message) && /column|schema cache|pgrst/i.test(error.message)) {
      return { error: "Agent codes need the latest database SQL. Run 20260905020000_agent_code_expiry.sql in Supabase." };
    }
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message };
  }
  return { error: "Could not allocate an agent code" };
}

async function mintAgentSession(email: string) {
  const link = await adminGenerateMagicLink(email);
  if (link.error || !link.hashedToken) return { error: link.error ?? "Could not start the agent session" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: "Supabase is not configured" };
  const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anonClient.auth.verifyOtp({
    token_hash: link.hashedToken,
    type: "magiclink",
  });
  if (error || !data.session) return { error: error?.message ?? "Could not start the agent session" };
  return { session: data.session };
}

export async function loginWithAgentCode(input: {
  code: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** Caller IP, so guessing is bounded per source and not just per code. */
  clientIp?: string;
}) {
  const softGps = isAgentSoftGpsEnabled();
  const lat =
    input.latitude === null || input.latitude === undefined || input.latitude === ""
      ? null
      : Number(input.latitude);
  const lng =
    input.longitude === null || input.longitude === undefined || input.longitude === ""
      ? null
      : Number(input.longitude);
  // Number(null) === 0 — never treat missing coords as the Gulf of Guinea
  const hasGps = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const invalid = validateAgentCodeLogin({
    code: input.code,
    latitude: hasGps ? lat : null,
    longitude: hasGps ? lng : null,
    requireGps: !softGps,
  });
  if (invalid) return { error: invalid };

  // Two windows: one per source so a single host cannot sweep the keyspace, one
  // per code so a distributed sweep of one code still runs out of attempts.
  const byIp = await checkRateLimit("agentCodeLogin", input.clientIp ?? "unknown");
  if (!byIp.allowed) {
    return { error: `Too many sign-in attempts. Try again in ${retryLabel(byIp.retryAfterSeconds)}.` };
  }
  const byCode = await checkRateLimit("agentCodeLoginPerCode", hashAgentCode(input.code));
  if (!byCode.allowed) {
    return { error: `Too many sign-in attempts for that code. Try again in ${retryLabel(byCode.retryAfterSeconds)}.` };
  }

  const admin = createServiceClient();
  const codeQuery = await admin
    .from("agent_access_codes")
    .select("id, tenant_id, profile_id, polling_unit_id, expires_at")
    .eq("code_hash", hashAgentCode(input.code))
    .is("revoked_at", null)
    .maybeSingle();
  let { data: row } = codeQuery;
  const { error } = codeQuery;
  if (error && /expires_at/i.test(error.message)) {
    // Database predates the expiry column: fall back to the older shape.
    const legacy = await admin
      .from("agent_access_codes")
      .select("id, tenant_id, profile_id, polling_unit_id")
      .eq("code_hash", hashAgentCode(input.code))
      .is("revoked_at", null)
      .maybeSingle();
    row = legacy.data ? { ...legacy.data, expires_at: null } : null;
  }
  if (error && isMissingRelationError(error.message, "agent_access_codes")) {
    return { error: "Agent codes are not enabled on this campaign yet. Ask HQ to apply the latest SQL." };
  }
  if (error && !/expires_at/i.test(error.message)) return { error: error.message };
  if (!row) return { error: "That agent code is not valid" };
  if (isAgentCodeExpired(row.expires_at)) {
    return { error: "That agent code has expired. Ask HQ to issue a new one." };
  }

  const [{ data: profile }, { data: pu }] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, role, tenant_id").eq("id", row.profile_id).maybeSingle(),
    admin
      .from("polling_units")
      .select("id, code, pu_code, name, ward, lga, state, latitude, longitude, assigned_agent_id, tenant_id, state_code, lg_code, ward_code")
      .eq("id", row.polling_unit_id)
      .maybeSingle(),
  ]);
  if (!profile || profile.role !== "polling_agent") {
    return { error: "That code is not a Field Agent login" };
  }
  if (!pu || pu.tenant_id !== profile.tenant_id) {
    return { error: "This code is not tied to a polling unit" };
  }
  if (pu.assigned_agent_id !== profile.id) {
    return { error: "This code is no longer tied to a polling unit. Ask HQ to issue a new one." };
  }

  let distanceM: number | null = null;
  let gpsVerified = false;

  if (hasGps) {
    if (pu.latitude == null || pu.longitude == null) {
      if (!softGps) {
        return { error: "This polling unit has no map pin. Ask HQ to geocode it, then try again." };
      }
    } else {
      distanceM = haversineMeters(lat!, lng!, Number(pu.latitude), Number(pu.longitude));
      if (!isWithinAgentLoginRadius(distanceM)) {
        const km = (distanceM / 1000).toFixed(1);
        return {
          error: `You are ${km} km from ${formatPollingUnitCode(pu)}. Sign in at your assigned polling unit (within ${(AGENT_LOGIN_RADIUS_M / 1000).toFixed(1)} km), or turn off GPS and use soft check-in.`,
        };
      }
      gpsVerified = true;
    }
  } else if (!softGps) {
    return { error: "Turn on location so we can confirm you are at your polling unit" };
  } else if (pu.latitude != null && pu.longitude != null) {
    // Soft check-in exists for units HQ has not geocoded yet. When the unit does
    // have a pin, withholding GPS would otherwise be a way to sign in from
    // anywhere, so location is required.
    return { error: "Turn on location so we can confirm you are at your polling unit" };
  }

  const minted = await mintAgentSession(profile.email);
  if (minted.error || !minted.session) return { error: minted.error ?? "Could not start the agent session" };

  await admin
    .from("agent_access_codes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    session: minted.session,
    agent: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    },
    unit: {
      id: pu.id,
      code: formatPollingUnitCode(pu),
      pu_code: formatPollingUnitCode(pu),
      name: pu.name,
      ward: pu.ward,
      lga: pu.lga,
      latitude: pu.latitude != null ? Number(pu.latitude) : null,
      longitude: pu.longitude != null ? Number(pu.longitude) : null,
      distance_m: distanceM != null ? Math.round(distanceM) : null,
    },
    gpsVerified,
    displayCode: formatAgentCode(normalizeAgentCode(input.code)),
  };
}
