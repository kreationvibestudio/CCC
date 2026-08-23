"use server";

import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type UserRole } from "@/types/auth";
import { createInvitedAuthUser } from "@/lib/invites";
import { issueAgentAccessCode } from "@/lib/agent/code-login";
import { isMissingRelationError } from "@/lib/public-error";

const PU_COLS = "id, code, pu_code, name, ward, lga, assigned_agent_id, latitude, longitude";
const KEEP_ROLES = new Set([
  "super_administrator",
  "candidate",
  "campaign_director",
  "director_general",
]);

function tempPassword() {
  return `${randomBytes(9).toString("base64url")}Aa1!`;
}

function syntheticAgentEmail() {
  return `agent.${randomBytes(6).toString("hex")}@ccc.agent`;
}

function escapeIlikeExact(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (ch) => `\\${ch}`);
}

function canStaffAgents(role: UserRole) {
  return hasPermission(role, "polling_units.manage") || hasPermission(role, "admin.users");
}

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || !canStaffAgents(user.role)) return { error: "Unauthorized" as const, user: null };
  return { user, error: null };
}

function db() {
  return createServiceClient();
}

function revalidateAgents() {
  revalidatePath("/polling-units/agents");
  revalidatePath("/polling-units");
  revalidatePath("/agent");
}

async function findPuByCode(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  raw: string
) {
  const code = raw.trim();
  if (!code) return null;
  const { data: byCode } = await supabase
    .from("polling_units")
    .select(PU_COLS)
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .limit(1)
    .maybeSingle();
  if (byCode) return byCode;
  const { data: byPu } = await supabase
    .from("polling_units")
    .select(PU_COLS)
    .eq("tenant_id", tenantId)
    .eq("pu_code", code)
    .limit(1)
    .maybeSingle();
  return byPu;
}

export type AssignmentRow = {
  id: string;
  code: string;
  pu_code: string | null;
  name: string;
  ward: string;
  lga: string;
  assigned_agent_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  agent_phone: string | null;
  agent_code_hint: string | null;
  has_coordinates: boolean;
};

export async function getAgentCoverage() {
  const auth = await requireStaff();
  if (!auth.user) return { assignedPus: 0, agents: 0 };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const [{ count: assignedPus }, { count: agents }] = await Promise.all([
    supabase
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("assigned_agent_id", "is", null),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "polling_agent"),
  ]);
  return { assignedPus: assignedPus ?? 0, agents: agents ?? 0 };
}

export async function listAgentAssignments(input?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AssignmentRow[]; total: number; codesTableMissing?: boolean }> {
  const auth = await requireStaff();
  if (!auth.user) return { rows: [], total: 0 };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const page = Math.max(0, input?.page ?? 0);
  const pageSize = Math.min(Math.max(input?.pageSize ?? 40, 1), 100);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const search = (input?.search ?? "").trim().slice(0, 64);

  let q = supabase
    .from("polling_units")
    .select(PU_COLS, { count: "exact" })
    .eq("tenant_id", tenantId)
    .not("assigned_agent_id", "is", null)
    .order("code");
  if (search.length >= 2) {
    q = q.or(`code.ilike."%${search}%",pu_code.ilike."%${search}%",name.ilike."%${search}%"`);
  }
  const { data, count } = await q.range(from, to);
  const units = data ?? [];
  const agentIds = [...new Set(units.map((u) => u.assigned_agent_id).filter(Boolean))] as string[];
  const names = new Map<string, { full_name: string; email: string; phone: string | null }>();
  const hints = new Map<string, string>();
  let codesTableMissing = false;
  if (agentIds.length) {
    const [{ data: profiles }, codesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone").eq("tenant_id", tenantId).in("id", agentIds),
      supabase
        .from("agent_access_codes")
        .select("profile_id, code_hint")
        .eq("tenant_id", tenantId)
        .in("profile_id", agentIds)
        .is("revoked_at", null),
    ]);
    for (const p of profiles ?? []) names.set(p.id, p);
    if (codesRes.error && isMissingRelationError(codesRes.error.message, "agent_access_codes")) {
      codesTableMissing = true;
    } else {
      for (const row of codesRes.data ?? []) hints.set(row.profile_id, row.code_hint);
    }
  }
  return {
    total: count ?? units.length,
    codesTableMissing,
    rows: units.map((u) => {
      const agent = u.assigned_agent_id ? names.get(u.assigned_agent_id) : null;
      return {
        id: u.id,
        code: u.code,
        pu_code: u.pu_code,
        name: u.name,
        ward: u.ward,
        lga: u.lga,
        assigned_agent_id: u.assigned_agent_id,
        agent_name: agent?.full_name ?? null,
        agent_email: agent?.email ?? null,
        agent_phone: agent?.phone ?? null,
        agent_code_hint: u.assigned_agent_id ? hints.get(u.assigned_agent_id) ?? null : null,
        has_coordinates: u.latitude != null && u.longitude != null,
      };
    }),
  };
}

export async function assignPollingAgent(input: {
  puCode: string;
  email?: string;
  fullName?: string;
  phone?: string;
}): Promise<{
      error?: string;
      created?: boolean;
      agentCode?: string;
      puCode?: string;
      email?: string;
      fullName?: string;
      missingCoordinates?: boolean;
    }> {
  try {
    const auth = await requireStaff();
    if (!auth.user) return { error: "Unauthorized" };

    const emailInput = (input.email ?? "").trim().toLowerCase();
    const puCode = input.puCode.trim();
    const phone = (input.phone ?? "").trim() || null;
    if (!puCode) return { error: "PU code is required" };
    if (emailInput && !emailInput.includes("@")) return { error: "Valid email is required" };

    const supabase = db();
    const tenantId = auth.user.profile.tenant_id;
    const pu = await findPuByCode(supabase, tenantId, puCode);
    if (!pu) return { error: `No polling unit matches ${puCode}` };

    const fullName =
      (input.fullName ?? "").trim() ||
      (emailInput ? emailInput.split("@")[0] : "") ||
      `Agent ${pu.pu_code || pu.code}`;
    if (fullName.length < 2) return { error: "Agent name is required" };

    let existing: { id: string; role: string; email: string } | undefined;
    if (emailInput) {
      const { data: existingRows } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("tenant_id", tenantId)
        .ilike("email", escapeIlikeExact(emailInput))
        .limit(5);
      existing =
        (existingRows ?? []).find((row) => row.email?.toLowerCase() === emailInput) ?? existingRows?.[0];
    }

    let userId = existing?.id as string | undefined;
    let created = false;
    let password: string | undefined;
    let email = existing?.email?.toLowerCase() || emailInput;

    if (existing && KEEP_ROLES.has(existing.role)) {
      return { error: `${email} is ${existing.role.replace(/_/g, " ")} — assign a different account` };
    }

    if (!userId) {
      email = email || syntheticAgentEmail();
      password = tempPassword();
      const invited = await createInvitedAuthUser(supabase, {
        tenantId,
        email,
        fullName,
        role: "polling_agent",
        password,
        invitedBy: auth.user.id,
      });
      if (invited.error || !invited.userId) return { error: invited.error ?? "Could not create agent login" };
      userId = invited.userId;
      created = Boolean(invited.created);
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        phone,
        role: "polling_agent",
        ward: pu.ward,
        lga: pu.lga,
      },
      { onConflict: "id" }
    );
    if (profileError) return { error: profileError.message };

    await supabase
      .from("polling_units")
      .update({ assigned_agent_id: null })
      .eq("tenant_id", tenantId)
      .eq("assigned_agent_id", userId)
      .neq("id", pu.id);

    const { error: assignError } = await supabase
      .from("polling_units")
      .update({ assigned_agent_id: userId })
      .eq("tenant_id", tenantId)
      .eq("id", pu.id);
    if (assignError) return { error: assignError.message };

    const issued = await issueAgentAccessCode({
      tenantId,
      profileId: userId,
      pollingUnitId: pu.id,
    });
    if (issued.error) return { error: issued.error };

    revalidateAgents();
    return {
      created,
      agentCode: issued.code,
      puCode: pu.pu_code || pu.code,
      email,
      fullName,
      missingCoordinates: pu.latitude == null || pu.longitude == null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create agent login" };
  }
}

export async function getAgentAccessCodesSql() {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" as const, sql: "" };
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260823000003_agent_access_codes.sql"),
    "utf8"
  );
  return { sql };
}

export async function resetAgentAccessCode(pollingUnitId: string): Promise<{ error?: string; agentCode?: string }> {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const { data: pu } = await supabase
    .from("polling_units")
    .select("id, assigned_agent_id")
    .eq("tenant_id", tenantId)
    .eq("id", pollingUnitId)
    .maybeSingle();
  if (!pu?.assigned_agent_id) return { error: "No Field Agent is tied to this unit" };
  const issued = await issueAgentAccessCode({
    tenantId,
    profileId: pu.assigned_agent_id,
    pollingUnitId: pu.id,
  });
  if (issued.error || !issued.code) return { error: issued.error ?? "Could not issue a new code" };
  revalidateAgents();
  return { agentCode: issued.code };
}

export async function unassignPollingAgent(pollingUnitId: string) {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const { data: pu } = await supabase
    .from("polling_units")
    .select("assigned_agent_id")
    .eq("tenant_id", tenantId)
    .eq("id", pollingUnitId)
    .maybeSingle();
  if (pu?.assigned_agent_id) {
    const revoked = await supabase
      .from("agent_access_codes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("profile_id", pu.assigned_agent_id)
      .is("revoked_at", null);
    if (revoked.error && !isMissingRelationError(revoked.error.message, "agent_access_codes")) {
      return { error: revoked.error.message };
    }
  }
  const { error } = await supabase
    .from("polling_units")
    .update({ assigned_agent_id: null })
    .eq("tenant_id", tenantId)
    .eq("id", pollingUnitId);
  if (error) return { error: error.message };
  revalidateAgents();
  return { success: true as const };
}

export async function nudgeAssignedAgent(userId: string) {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const { nudgeAgent } = await import("@/lib/agent/media");
  return nudgeAgent(auth.user, userId, "Please open the Agent app and submit your unit update.");
}
