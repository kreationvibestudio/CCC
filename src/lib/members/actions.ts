"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { authorize } from "@/lib/auth/session";
import { denyCreateIfRestricted, denyDeleteIfRestricted } from "@/types/auth";
import { isMissingRelationError } from "@/lib/public-error";
import { ensureTenantPollingUnitFromNational } from "@/lib/polling-units/national";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { UNIT_MEMBERS_TABLE_MIGRATION_SQL } from "@/lib/members/schema";
import {
  memberDisplayName,
  validateMemberRegistration,
  type MemberRegistrationInput,
} from "@/lib/members/validate";
import type { UnitMember } from "@/types/database";

export type MemberListItem = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  voters_card_number: string;
  membership_card_number: string;
  state: string | null;
  lga: string;
  ward: string;
  unit_code: string | null;
  unit_name: string | null;
  polling_unit_id: string | null;
  created_at: string;
};

const MEMBER_SELECT =
  "id, tenant_id, polling_unit_id, first_name, last_name, phone, voters_card_number, membership_card_number, state, lga, ward, unit_code, unit_name, created_by, created_at, updated_at";

function toListItem(row: UnitMember): MemberListItem {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: memberDisplayName(row.first_name, row.last_name),
    phone: row.phone,
    voters_card_number: row.voters_card_number,
    membership_card_number: row.membership_card_number,
    state: row.state ?? null,
    lga: row.lga,
    ward: row.ward,
    unit_code: row.unit_code ?? null,
    unit_name: row.unit_name ?? null,
    polling_unit_id: row.polling_unit_id ?? null,
    created_at: row.created_at,
  };
}

function uniqueConflictMessage(message: string) {
  const unique = /unique|duplicate|already exists/i.test(message);
  if (/unit_members_tenant_id_phone/i.test(message) || (unique && /phone/i.test(message))) {
    return "A member with this phone number is already registered.";
  }
  if (unique && /voters_card/i.test(message)) {
    return "A member with this voter's card number is already registered.";
  }
  if (unique && /membership_card/i.test(message)) {
    return "A member with this NDC party card number is already registered.";
  }
  return message;
}

export async function getUnitMembersTableMigrationSql() {
  const gate = await authorize("members.manage", "admin.users");
  if (!gate.ok) return { error: gate.error, sql: "" };
  return { sql: UNIT_MEMBERS_TABLE_MIGRATION_SQL };
}

export async function unitMembersTableNeedsMigration(): Promise<boolean> {
  const gate = await authorize("members.view", "members.manage", "admin.users");
  if (!gate.ok) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("unit_members").select("id").limit(1);
  return Boolean(error && isMissingRelationError(error.message, "unit_members"));
}

export async function listUnitMembers(input?: { search?: string }): Promise<{
  rows: MemberListItem[];
  total: number;
  needsMigration?: boolean;
}> {
  const gate = await authorize("members.view", "members.manage", "admin.users");
  if (!gate.ok) return { rows: [], total: 0 };
  const supabase = await createClient();
  const tenantId = gate.user.profile.tenant_id;
  const search = (input?.search ?? "").trim().slice(0, 64);

  let q = supabase
    .from("unit_members")
    .select(MEMBER_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (search.length >= 2) {
    const safe = search.replace(/[%_,()"]/g, "");
    q = q.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%,membership_card_number.ilike.%${safe}%,voters_card_number.ilike.%${safe}%,lga.ilike.%${safe}%,ward.ilike.%${safe}%,unit_code.ilike.%${safe}%`
    );
  }

  const { data, count, error } = await q.limit(500);
  if (error) {
    if (isMissingRelationError(error.message, "unit_members")) {
      return { rows: [], total: 0, needsMigration: true };
    }
    return { rows: [], total: 0 };
  }

  const rows = (data ?? []) as UnitMember[];
  return {
    total: count ?? rows.length,
    rows: rows.map(toListItem),
  };
}

export async function getUnitMember(id: string): Promise<{
  member?: MemberListItem;
  error?: string;
  needsMigration?: boolean;
}> {
  const gate = await authorize("members.view", "members.manage", "admin.users");
  if (!gate.ok) return { error: gate.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_members")
    .select(MEMBER_SELECT)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error.message, "unit_members")) {
      return { error: "Members table is missing. Run the Members SQL migration.", needsMigration: true };
    }
    return { error: error.message };
  }
  if (!data) return { error: "Member not found" };
  return { member: toListItem(data as UnitMember) };
}

export async function createUnitMember(input: MemberRegistrationInput): Promise<{
  error?: string;
  id?: string;
  needsMigration?: boolean;
}> {
  const gate = await authorize("members.manage", "admin.users");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyCreateIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const validated = validateMemberRegistration(input);
  if ("error" in validated) return { error: validated.error };
  const value = validated.value;

  const tenantId = gate.user.profile.tenant_id;
  let pollingUnitId = value.pollingUnitId;
  let unitCode = value.unitCode;
  let unitName = value.unitName;

  if (pollingUnitId) {
    const ensured = await ensureTenantPollingUnitFromNational({
      tenantId,
      nationalId: pollingUnitId,
    });
    if ("error" in ensured) return { error: ensured.error };
    pollingUnitId = ensured.id;

    const admin = createServiceClient();
    const { data: pu } = await admin
      .from("polling_units")
      .select("id, code, pu_code, name, ward, lga, state")
      .eq("tenant_id", tenantId)
      .eq("id", pollingUnitId)
      .maybeSingle();
    if (pu) {
      unitCode = formatPollingUnitCode(pu) || unitCode;
      unitName = (pu.name ?? "").trim() || unitName;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_members")
    .insert({
      tenant_id: tenantId,
      polling_unit_id: pollingUnitId,
      first_name: value.firstName,
      last_name: value.lastName,
      phone: value.phone,
      voters_card_number: value.votersCardNumber,
      membership_card_number: value.membershipCardNumber,
      state: value.state,
      lga: value.lga,
      ward: value.ward,
      unit_code: unitCode,
      unit_name: unitName,
      created_by: gate.user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error.message, "unit_members")) {
      return {
        error: "Members table is missing. Run the Members SQL migration.",
        needsMigration: true,
      };
    }
    return { error: uniqueConflictMessage(error.message) };
  }

  try {
    await createServiceClient().from("activities").insert({
      tenant_id: tenantId,
      action: "member.registered",
      description: `${memberDisplayName(value.firstName, value.lastName)} registered as an NDC unit member`,
      metadata: {
        phone: value.phone,
        lga: value.lga,
        ward: value.ward,
        unit_code: unitCode,
        membership_card_number: value.membershipCardNumber,
      },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/members");
  return { id: data?.id };
}

export async function deleteUnitMember(id: string): Promise<{ error?: string; success?: true }> {
  const gate = await authorize("members.manage", "admin.users");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyDeleteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_members")
    .delete()
    .eq("tenant_id", gate.user.profile.tenant_id)
    .eq("id", id);
  if (error) {
    if (isMissingRelationError(error.message, "unit_members")) {
      return { error: "Members table is missing. Run the Members SQL migration." };
    }
    return { error: error.message };
  }
  revalidatePath("/members");
  return { success: true };
}
