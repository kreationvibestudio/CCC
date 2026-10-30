"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { denyCreateIfRestricted, hasPermission, type UserRole } from "@/types/auth";
import { assignPollingAgent } from "@/lib/agents/actions";
import {
  AGENTS_TABLE_MIGRATION_SQL,
  AGENT_NIN_MIGRATION_SQL,
  collationFlags,
  collationLabel,
  normalizeCollationRole,
  type AgentCollationRole,
} from "@/lib/agents/identity-fields";
import { isMissingRelationError } from "@/lib/public-error";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import {
  normalizeNin,
  sanitizeNinVerificationForStorage,
  splitPersonName,
  verifyNinIdentity,
} from "@/lib/integrations/verifyme/client";
import type { Agent } from "@/types/database";

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

function revalidateRegistration() {
  revalidatePath("/agents");
  revalidatePath("/polling-units/agents");
  revalidatePath("/polling-units");
  revalidatePath("/agent");
}

export type AgentListItem = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  state: string | null;
  lga: string | null;
  ward: string | null;
  membership_card_number: string | null;
  voters_card_number: string | null;
  passport_photo_url: string | null;
  nin: string | null;
  date_of_birth: string | null;
  nin_verified_at: string | null;
  nin_verification: Record<string, unknown> | null;
  collation_role: AgentCollationRole;
  collation_label: string | null;
  polling_unit_id: string;
  pu_code: string;
  pu_name: string;
  pu_ward: string;
  pu_lga: string;
  pu_state: string;
  profile_id: string | null;
  created_at: string;
};

export type AgentDetail = AgentListItem & {
  is_lga_collation_agent: boolean;
  is_ward_collation_agent: boolean;
  agent_code: string | null;
};

const AGENT_SELECT =
  "id, tenant_id, polling_unit_id, profile_id, full_name, phone, email, state, lga, ward, membership_card_number, voters_card_number, passport_photo_url, nin, date_of_birth, nin_verified_at, nin_verification, is_lga_collation_agent, is_ward_collation_agent, created_by, created_at, updated_at";

function toListItem(
  row: Agent,
  pu: {
    code?: string | null;
    pu_code?: string | null;
    name?: string | null;
    ward?: string | null;
    lga?: string | null;
    state?: string | null;
  } | null
): AgentListItem {
  const role = normalizeCollationRole({
    isLgaCollationAgent: row.is_lga_collation_agent,
    isWardCollationAgent: row.is_ward_collation_agent,
  });
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email ?? null,
    state: row.state ?? null,
    lga: row.lga ?? null,
    ward: row.ward ?? null,
    membership_card_number: row.membership_card_number ?? null,
    voters_card_number: row.voters_card_number ?? null,
    passport_photo_url: row.passport_photo_url ?? null,
    nin: row.nin ?? null,
    date_of_birth: row.date_of_birth ?? null,
    nin_verified_at: row.nin_verified_at ?? null,
    nin_verification: (row.nin_verification as Record<string, unknown> | null) ?? null,
    collation_role: role,
    collation_label: collationLabel(role),
    polling_unit_id: row.polling_unit_id,
    pu_code: pu ? formatPollingUnitCode(pu) : "",
    pu_name: pu?.name ?? "",
    pu_ward: pu?.ward ?? "",
    pu_lga: pu?.lga ?? "",
    pu_state: pu?.state ?? "",
    profile_id: row.profile_id ?? null,
    created_at: row.created_at,
  };
}

export async function getAgentsTableMigrationSql() {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" as const, sql: "" };
  return { sql: AGENTS_TABLE_MIGRATION_SQL };
}

export async function getAgentNinMigrationSql() {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" as const, sql: "" };
  return { sql: AGENT_NIN_MIGRATION_SQL };
}

export async function agentsTableNeedsMigration(): Promise<boolean> {
  const auth = await requireStaff();
  if (!auth.user) return false;
  const { error } = await db()
    .from("agents")
    .select("id")
    .eq("tenant_id", auth.user.profile.tenant_id)
    .limit(1);
  return Boolean(error && isMissingRelationError(error.message, "agents"));
}

export async function listAgents(input?: {
  search?: string;
}): Promise<{ rows: AgentListItem[]; total: number; needsAgentsMigration?: boolean }> {
  const auth = await requireStaff();
  if (!auth.user) return { rows: [], total: 0 };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const search = (input?.search ?? "").trim().slice(0, 64);

  let q = supabase
    .from("agents")
    .select(AGENT_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (search.length >= 2) {
    const safe = search.replace(/[%_,()"]/g, "");
    q = q.or(
      `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,membership_card_number.ilike.%${safe}%,voters_card_number.ilike.%${safe}%,nin.ilike.%${safe}%`
    );
  }
  const { data, count, error } = await q.limit(200);
  if (error) {
    if (isMissingRelationError(error.message, "agents")) {
      return { rows: [], total: 0, needsAgentsMigration: true };
    }
    // Older cloud DBs may lack nin columns — retry without them.
    if (/nin|date_of_birth|nin_verif|column/i.test(error.message)) {
      const legacy = await supabase
        .from("agents")
        .select(
          "id, tenant_id, polling_unit_id, profile_id, full_name, phone, email, ward, membership_card_number, voters_card_number, passport_photo_url, is_lga_collation_agent, is_ward_collation_agent, created_by, created_at, updated_at",
          { count: "exact" }
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (legacy.error) return { rows: [], total: 0 };
      const legacyRows = (legacy.data ?? []) as Agent[];
      const puIdsLegacy = [...new Set(legacyRows.map((r) => r.polling_unit_id))];
      const puMapLegacy = new Map<
        string,
        { code: string | null; pu_code: string | null; name: string; ward: string; lga: string; state: string }
      >();
      if (puIdsLegacy.length) {
        const { data: units } = await supabase
          .from("polling_units")
          .select("id, code, pu_code, name, ward, lga, state")
          .eq("tenant_id", tenantId)
          .in("id", puIdsLegacy);
        for (const u of units ?? []) puMapLegacy.set(u.id, u);
      }
      return {
        total: legacy.count ?? legacyRows.length,
        rows: legacyRows.map((row) => toListItem(row, puMapLegacy.get(row.polling_unit_id) ?? null)),
      };
    }
    return { rows: [], total: 0 };
  }

  const rows = (data ?? []) as Agent[];
  const puIds = [...new Set(rows.map((r) => r.polling_unit_id))];
  const puMap = new Map<
    string,
    { code: string | null; pu_code: string | null; name: string; ward: string; lga: string; state: string }
  >();
  if (puIds.length) {
    const { data: units } = await supabase
      .from("polling_units")
      .select("id, code, pu_code, name, ward, lga, state")
      .eq("tenant_id", tenantId)
      .in("id", puIds);
    for (const u of units ?? []) puMap.set(u.id, u);
  }

  return {
    total: count ?? rows.length,
    rows: rows.map((row) => toListItem(row, puMap.get(row.polling_unit_id) ?? null)),
  };
}

export async function getAgent(id: string): Promise<{
  agent?: AgentDetail;
  error?: string;
  needsAgentsMigration?: boolean;
}> {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error.message, "agents")) {
      return { error: "Agents table is missing. Run the Agents SQL migration.", needsAgentsMigration: true };
    }
    return { error: error.message };
  }
  if (!data) return { error: "Agent not found" };

  const row = data as Agent;
  const { data: pu } = await supabase
    .from("polling_units")
    .select("id, code, pu_code, name, ward, lga, state")
    .eq("tenant_id", tenantId)
    .eq("id", row.polling_unit_id)
    .maybeSingle();

  let agentCode: string | null = null;
  if (row.profile_id) {
    const { data: codeRow } = await supabase
      .from("agent_access_codes")
      .select("code_display")
      .eq("tenant_id", tenantId)
      .eq("profile_id", row.profile_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (codeRow?.code_display) {
      const { decryptAgentCode } = await import("@/lib/agent/code-vault");
      const { formatAgentCode } = await import("@/lib/agent/access-code");
      const decrypted = decryptAgentCode(codeRow.code_display as string);
      agentCode = decrypted ? formatAgentCode(decrypted) : null;
    }
  }

  const base = toListItem(row, pu);
  return {
    agent: {
      ...base,
      is_lga_collation_agent: row.is_lga_collation_agent,
      is_ward_collation_agent: row.is_ward_collation_agent,
      agent_code: agentCode,
    },
  };
}

export async function createAgentRegistration(input: {
  puCode?: string;
  pollingUnitId?: string;
  fullName: string;
  phone: string;
  state?: string;
  lga?: string;
  ward?: string;
  email?: string;
  membershipCardNumber?: string;
  votersCardNumber?: string;
  passportPhotoUrl?: string;
  collationRole?: string;
  nin?: string;
  dateOfBirth?: string;
  ninVerifiedAt?: string;
  ninVerification?: Record<string, unknown> | null;
}): Promise<{
  error?: string;
  id?: string;
  agentCode?: string;
  puCode?: string;
  needsAgentsMigration?: boolean;
  needsIdentityMigration?: boolean;
  needsNinMigration?: boolean;
}> {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const blocked = denyCreateIfRestricted(auth.user.role);
  if (blocked) return { error: blocked };

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const puCode = (input.puCode ?? "").trim();
  const pollingUnitId = (input.pollingUnitId ?? "").trim();
  const votersCardNumber = (input.votersCardNumber ?? "").trim() || null;
  const ninRaw = (input.nin ?? "").trim();
  const nin = ninRaw ? normalizeNin(ninRaw) : null;
  const dateOfBirth = (input.dateOfBirth ?? "").trim() || null;
  if (fullName.length < 2) return { error: "Agent name is required" };
  if (!phone) return { error: "Phone number is required" };
  if (!puCode && !pollingUnitId) return { error: "Polling unit is required" };
  if (!votersCardNumber) return { error: "Voter's card number is required" };
  if (!nin) return { error: "NIN is required (11 digits)" };
  if (!dateOfBirth) return { error: "Date of birth is required for NIN verification" };

  let ninVerifiedAt = input.ninVerifiedAt ?? null;
  let ninVerification = input.ninVerification ?? null;
  if (!ninVerifiedAt || !ninVerification) {
    const { firstname, lastname } = splitPersonName(fullName);
    const verified = await verifyNinIdentity({
      nin,
      firstname,
      lastname,
      dob: dateOfBirth,
    });
    if (!verified.ok || !verified.data) {
      return { error: verified.error ?? "Verify the NIN before saving this agent" };
    }
    ninVerification = sanitizeNinVerificationForStorage(verified.data, { demo: verified.demo });
    ninVerifiedAt = String(ninVerification.verified_at ?? new Date().toISOString());
  }

  const collationRole = normalizeCollationRole({ collationRole: input.collationRole });
  const identity = collationFlags(collationRole);
  const membershipCardNumber = (input.membershipCardNumber ?? "").trim() || null;
  const passportPhotoUrl = (input.passportPhotoUrl ?? "").trim() || null;
  const ward = (input.ward ?? "").trim() || null;
  const state = (input.state ?? "").trim() || null;
  const lga = (input.lga ?? "").trim() || null;
  const email = (input.email ?? "").trim().toLowerCase() || null;

  const provisioned = await assignPollingAgent({
    puCode: puCode || undefined,
    pollingUnitId: pollingUnitId || undefined,
    fullName,
    phone,
    ward: ward ?? undefined,
    email: email ?? undefined,
    membershipCardNumber: membershipCardNumber ?? undefined,
    votersCardNumber: votersCardNumber ?? undefined,
    passportPhotoUrl: passportPhotoUrl ?? undefined,
    collationRole,
    nin: nin ?? undefined,
    dateOfBirth: dateOfBirth ?? undefined,
    ninVerifiedAt,
    ninVerification,
  });
  if (provisioned.error) {
    return {
      error: provisioned.error,
      needsIdentityMigration: provisioned.needsIdentityMigration,
    };
  }
  if (!provisioned.pollingUnitId || !provisioned.profileId) {
    return { error: "Could not link agent to polling unit" };
  }

  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;

  const agentPayload = {
    profile_id: provisioned.profileId,
    full_name: provisioned.fullName || fullName,
    phone,
    email,
    state: state || null,
    lga: lga || null,
    ward: ward || null,
    membership_card_number: membershipCardNumber,
    voters_card_number: votersCardNumber,
    passport_photo_url: passportPhotoUrl,
    nin,
    date_of_birth: dateOfBirth,
    nin_verified_at: ninVerifiedAt,
    nin_verification: ninVerification,
    ...identity,
    updated_at: new Date().toISOString(),
  };

  const existing = await supabase
    .from("agents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("polling_unit_id", provisioned.pollingUnitId)
    .maybeSingle();
  if (existing.error && isMissingRelationError(existing.error.message, "agents")) {
    return {
      id: undefined,
      agentCode: provisioned.agentCode,
      puCode: provisioned.puCode,
      needsAgentsMigration: true,
      needsIdentityMigration: provisioned.needsIdentityMigration,
      error:
        "Agent login was created, but the Agents registration table is missing. Run the Agents SQL, then register again to store the paperwork record.",
    };
  }
  if (existing.data?.id) {
    const { error: updateError } = await supabase
      .from("agents")
      .update(agentPayload)
      .eq("id", existing.data.id)
      .eq("tenant_id", tenantId);
    if (updateError) {
      if (/nin|date_of_birth|nin_verif|column/i.test(updateError.message)) {
        return {
          error:
            "NIN columns are missing on the agents table. Run the NIN SQL migration, then register again.",
          needsNinMigration: true,
        };
      }
      return { error: updateError.message };
    }
    revalidateRegistration();
    return {
      id: existing.data.id,
      agentCode: provisioned.agentCode,
      puCode: provisioned.puCode,
      needsIdentityMigration: provisioned.needsIdentityMigration,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("agents")
    .insert({
      tenant_id: tenantId,
      polling_unit_id: provisioned.pollingUnitId,
      created_by: auth.user.id,
      ...agentPayload,
    })
    .select("id")
    .single();

  if (insertError) {
    if (isMissingRelationError(insertError.message, "agents")) {
      return {
        agentCode: provisioned.agentCode,
        puCode: provisioned.puCode,
        needsAgentsMigration: true,
        needsIdentityMigration: provisioned.needsIdentityMigration,
        error:
          "Agent login was created, but the Agents registration table is missing. Run the Agents SQL, then register again to store the paperwork record.",
      };
    }
    if (/nin|date_of_birth|nin_verif|column/i.test(insertError.message)) {
      return {
        error:
          "NIN columns are missing on the agents table. Run the NIN SQL migration, then register again.",
        needsNinMigration: true,
        agentCode: provisioned.agentCode,
        puCode: provisioned.puCode,
      };
    }
    return { error: insertError.message };
  }

  revalidateRegistration();
  return {
    id: inserted.id,
    agentCode: provisioned.agentCode,
    puCode: provisioned.puCode,
    needsIdentityMigration: provisioned.needsIdentityMigration,
  };
}

export async function updateAgentRegistration(
  id: string,
  input: {
    fullName?: string;
    phone?: string;
    state?: string;
    lga?: string;
    ward?: string;
    email?: string;
    membershipCardNumber?: string;
    votersCardNumber?: string;
    passportPhotoUrl?: string;
    collationRole?: string;
    nin?: string;
    dateOfBirth?: string;
    ninVerifiedAt?: string | null;
    ninVerification?: Record<string, unknown> | null;
  }
): Promise<{ error?: string; needsAgentsMigration?: boolean; needsNinMigration?: boolean }> {
  const auth = await requireStaff();
  if (!auth.user) return { error: "Unauthorized" };
  const blocked = denyCreateIfRestricted(auth.user.role);
  if (blocked) return { error: blocked };

  const supabase = db();
  const tenantId = auth.user.profile.tenant_id;
  const { data: current, error: loadError } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    if (isMissingRelationError(loadError.message, "agents")) {
      return { error: "Agents table is missing", needsAgentsMigration: true };
    }
    return { error: loadError.message };
  }
  if (!current) return { error: "Agent not found" };

  const row = current as Agent;
  const fullName = (input.fullName ?? row.full_name).trim();
  const phone = (input.phone ?? row.phone).trim();
  if (fullName.length < 2) return { error: "Agent name is required" };
  if (!phone) return { error: "Phone number is required" };

  const votersCardNumber =
    input.votersCardNumber !== undefined
      ? input.votersCardNumber.trim() || null
      : row.voters_card_number ?? null;
  if (!votersCardNumber) return { error: "Voter's card number is required" };

  let nin =
    input.nin !== undefined
      ? input.nin.trim()
        ? normalizeNin(input.nin)
        : null
      : row.nin ?? null;
  if (input.nin !== undefined && input.nin.trim() && !nin) {
    return { error: "NIN must be 11 digits" };
  }
  if (!nin) return { error: "NIN is required (11 digits)" };

  const dateOfBirth =
    input.dateOfBirth !== undefined
      ? input.dateOfBirth.trim() || null
      : row.date_of_birth ?? null;
  if (!dateOfBirth) return { error: "Date of birth is required" };

  const ninChanged = input.nin !== undefined && normalizeNin(input.nin ?? "") !== (row.nin ?? null);
  const dobChanged =
    input.dateOfBirth !== undefined &&
    (input.dateOfBirth.trim() || null) !== (row.date_of_birth ?? null);
  if ((ninChanged || dobChanged) && (!input.ninVerifiedAt || !input.ninVerification)) {
    return { error: "Re-verify the NIN after changing NIN or date of birth" };
  }

  const collationRole = normalizeCollationRole({
    collationRole: input.collationRole,
    isLgaCollationAgent: row.is_lga_collation_agent,
    isWardCollationAgent: row.is_ward_collation_agent,
  });
  const identity = collationFlags(
    input.collationRole !== undefined
      ? normalizeCollationRole({ collationRole: input.collationRole })
      : collationRole
  );

  const payload = {
    full_name: fullName,
    phone,
    email:
      input.email !== undefined
        ? input.email.trim().toLowerCase() || null
        : row.email ?? null,
    state: input.state !== undefined ? input.state.trim() || null : row.state ?? null,
    lga: input.lga !== undefined ? input.lga.trim() || null : row.lga ?? null,
    ward: input.ward !== undefined ? input.ward.trim() || null : row.ward ?? null,
    membership_card_number:
      input.membershipCardNumber !== undefined
        ? input.membershipCardNumber.trim() || null
        : row.membership_card_number ?? null,
    voters_card_number: votersCardNumber,
    passport_photo_url:
      input.passportPhotoUrl !== undefined
        ? input.passportPhotoUrl.trim() || null
        : row.passport_photo_url ?? null,
    nin,
    date_of_birth: dateOfBirth,
    nin_verified_at:
      input.ninVerifiedAt !== undefined
        ? input.ninVerifiedAt
        : row.nin_verified_at ?? null,
    nin_verification:
      input.ninVerification !== undefined
        ? input.ninVerification
        : row.nin_verification ?? null,
    ...identity,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("agents")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (updateError) {
    if (/nin|date_of_birth|nin_verif|column/i.test(updateError.message)) {
      return {
        error: "NIN columns are missing. Run the NIN SQL migration.",
        needsNinMigration: true,
      };
    }
    return { error: updateError.message };
  }

  if (row.profile_id) {
    await supabase
      .from("profiles")
      .update({
        full_name: payload.full_name,
        phone: payload.phone,
        email: payload.email ?? undefined,
        ward: payload.ward,
        lga: payload.lga,
        membership_card_number: payload.membership_card_number,
        voters_card_number: payload.voters_card_number,
        passport_photo_url: payload.passport_photo_url,
        nin: payload.nin,
        date_of_birth: payload.date_of_birth,
        nin_verified_at: payload.nin_verified_at,
        nin_verification: payload.nin_verification,
        is_lga_collation_agent: payload.is_lga_collation_agent,
        is_ward_collation_agent: payload.is_ward_collation_agent,
      })
      .eq("id", row.profile_id)
      .eq("tenant_id", tenantId);
  }

  revalidateRegistration();
  revalidatePath(`/agents/${id}`);
  return {};
}
