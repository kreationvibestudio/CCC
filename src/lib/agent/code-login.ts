import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { adminGenerateMagicLink } from "@/lib/auth/admin-users";
import {
  formatAgentCode,
  generateAgentCode,
  hashAgentCode,
  normalizeAgentCode,
  agentCodeHint,
  validateAgentCodeLogin,
} from "@/lib/agent/access-code";
import { AGENT_LOGIN_RADIUS_M, haversineMeters, isWithinAgentLoginRadius } from "@/lib/agent/geo";
import { isMissingRelationError } from "@/lib/public-error";

export { AGENT_LOGIN_RADIUS_M };

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
    });
    if (!error) return { code, hint: agentCodeHint(code) };
    if (isMissingRelationError(error.message, "agent_access_codes")) {
      return { error: "Agent codes need the latest database SQL. Run 20260823000003_agent_access_codes.sql in Supabase." };
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
  latitude: number;
  longitude: number;
}) {
  const invalid = validateAgentCodeLogin(input);
  if (invalid) return { error: invalid };
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);

  const admin = createServiceClient();
  const { data: row, error } = await admin
    .from("agent_access_codes")
    .select("id, tenant_id, profile_id, polling_unit_id")
    .eq("code_hash", hashAgentCode(input.code))
    .is("revoked_at", null)
    .maybeSingle();
  if (error && isMissingRelationError(error.message, "agent_access_codes")) {
    return { error: "Agent codes are not enabled on this campaign yet. Ask HQ to apply the latest SQL." };
  }
  if (error) return { error: error.message };
  if (!row) return { error: "That agent code is not valid" };

  const [{ data: profile }, { data: pu }] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, role, tenant_id").eq("id", row.profile_id).maybeSingle(),
    admin
      .from("polling_units")
      .select("id, code, pu_code, name, ward, lga, latitude, longitude, assigned_agent_id, tenant_id")
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
  if (pu.latitude == null || pu.longitude == null) {
    return { error: "This polling unit has no map pin. Ask HQ to geocode it, then try again." };
  }

  const distanceM = haversineMeters(lat, lng, Number(pu.latitude), Number(pu.longitude));
  if (!isWithinAgentLoginRadius(distanceM)) {
    const km = (distanceM / 1000).toFixed(1);
    return {
      error: `You are ${km} km from ${pu.pu_code || pu.code}. Sign in at your assigned polling unit (within ${(AGENT_LOGIN_RADIUS_M / 1000).toFixed(1)} km).`,
    };
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
      code: pu.code,
      pu_code: pu.pu_code,
      name: pu.name,
      ward: pu.ward,
      lga: pu.lga,
      latitude: Number(pu.latitude),
      longitude: Number(pu.longitude),
      distance_m: Math.round(distanceM),
    },
    displayCode: formatAgentCode(normalizeAgentCode(input.code)),
  };
}
