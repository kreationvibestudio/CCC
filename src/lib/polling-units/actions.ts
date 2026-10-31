"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { denyCreateIfRestricted } from "@/types/auth";
import { deleteRecord, getRecord, updateRecord } from "@/lib/modules/crud-actions";
import { parsePollingUnitsCsv } from "@/lib/polling-units/csv";
import { upsertPollingUnitRows } from "@/lib/polling-units/import-rows";
import { formatPollingUnitCode, parsePollingUnitCode, withDisplayCode } from "@/lib/polling-units/code";
import { pollingUnitSearchOrFilter } from "@/lib/polling-units/lookup";
import { stateMatchOr } from "@/lib/polling-units/scope";
import {
  listNationalStates,
  listNationalStatesForLgas,
  listNationalWardsInLga,
} from "@/lib/polling-units/national";
import {
  getCampaignFocusState,
  setCampaignFocusState,
} from "@/lib/polling-units/focus-state";

const LIST_COLS =
  "id, code, pu_code, name, ward, lga, state, state_code, lg_code, ward_code, registered_voters, latitude, longitude, address, geocode_status";

function sanitizeFilter(raw: string) {
  return raw.trim().slice(0, 64).replace(/[%_,()"]/g, "");
}

export type PollingUnitListItem = {
  id: string;
  name: string;
  code: string;
  pu_code?: string | null;
  ward: string;
  lga: string;
  state: string;
  registered_voters: number | null;
  latitude: number | null;
  longitude: number | null;
  risk_level: string | null;
  ward_code?: string | null;
  lg_code?: string | null;
  state_code?: string | null;
  geocode_status?: string | null;
  address?: string | null;
  live_status?: string;
  turnout?: number;
  assigned_agent_id?: string | null;
};

export type PollingUnitSummary = {
  puCount: number;
  registeredVoters: number;
  mapped: number;
};

export async function getPollingUnitStates(): Promise<string[]> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return [];
  return listNationalStates();
}

export async function getPollingUnitLgas(state?: string): Promise<string[]> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return [];
  const trimmed = (state ?? "").trim();
  if (!trimmed) return [];
  return listNationalStatesForLgas(trimmed);
}

export async function getPollingUnitWards(lga: string, state?: string): Promise<string[]> {
  const trimmedLga = lga.trim();
  const trimmedState = (state ?? "").trim();
  if (!trimmedLga || !trimmedState) return [];
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return [];
  return listNationalWardsInLga(trimmedState, trimmedLga);
}

export async function getPollingUnitFocusState(): Promise<string | null> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return null;
  return getCampaignFocusState(gate.user.profile.tenant_id);
}

export async function savePollingUnitFocusState(formData: FormData) {
  const gate = await authorize("admin.users", "polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const state = String(formData.get("focus_state") ?? "").trim();
  const result = await setCampaignFocusState(gate.user.profile.tenant_id, state || null);
  if ("error" in result) return { error: result.error };
  revalidatePath("/polling-units");
  revalidatePath("/agents");
  revalidatePath("/admin");
  return { success: true as const };
}

export async function getPollingUnitSummary(filters?: {
  state?: string;
  lga?: string;
  ward?: string;
}): Promise<PollingUnitSummary> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return { puCount: 0, registeredVoters: 0, mapped: 0 };
  const state = sanitizeFilter(filters?.state ?? "");
  if (!state) return { puCount: 0, registeredVoters: 0, mapped: 0 };

  const supabase = await createClient();
  let countQuery = supabase
    .from("national_polling_units")
    .select("id", { count: "exact", head: true })
    .or(stateMatchOr(state));
  let mappedQuery = supabase
    .from("national_polling_units")
    .select("id", { count: "exact", head: true })
    .or(stateMatchOr(state))
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (filters?.lga) {
    countQuery = countQuery.eq("lga", filters.lga);
    mappedQuery = mappedQuery.eq("lga", filters.lga);
  }
  if (filters?.ward) {
    countQuery = countQuery.eq("ward", filters.ward);
    mappedQuery = mappedQuery.eq("ward", filters.ward);
  }

  const [{ count: puCount, error }, { count: mapped }] = await Promise.all([countQuery, mappedQuery]);
  if (error) {
    // Fallback to tenant-local before migration.
    return getTenantLocalSummary(gate.user.profile.tenant_id, filters);
  }

  let registeredVoters = 0;
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    let q = supabase
      .from("national_polling_units")
      .select("registered_voters")
      .or(stateMatchOr(state))
      .order("code");
    if (filters?.lga) q = q.eq("lga", filters.lga);
    if (filters?.ward) q = q.eq("ward", filters.ward);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = data ?? [];
    registeredVoters += rows.reduce((sum, row) => sum + Number(row.registered_voters ?? 0), 0);
    if (rows.length < pageSize) break;
  }
  return { puCount: puCount ?? 0, registeredVoters, mapped: mapped ?? 0 };
}

async function getTenantLocalSummary(
  tenantId: string,
  filters?: { state?: string; lga?: string; ward?: string }
): Promise<PollingUnitSummary> {
  const state = sanitizeFilter(filters?.state ?? "");
  if (!state) return { puCount: 0, registeredVoters: 0, mapped: 0 };
  const supabase = await createClient();
  let countQuery = supabase
    .from("polling_units")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .or(stateMatchOr(state));
  let mappedQuery = supabase
    .from("polling_units")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .or(stateMatchOr(state))
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (filters?.lga) {
    countQuery = countQuery.eq("lga", filters.lga);
    mappedQuery = mappedQuery.eq("lga", filters.lga);
  }
  if (filters?.ward) {
    countQuery = countQuery.eq("ward", filters.ward);
    mappedQuery = mappedQuery.eq("ward", filters.ward);
  }
  const [{ count: puCount }, { count: mapped }] = await Promise.all([countQuery, mappedQuery]);
  return { puCount: puCount ?? 0, registeredVoters: 0, mapped: mapped ?? 0 };
}

export async function countVotingActive(): Promise<number> {
  const gate = await authorize("polling_units.view", "situation_room.view");
  if (!gate.ok) return 0;
  const user = gate.user;
  const supabase = await createClient();
  const { count } = await supabase
    .from("polling_unit_status")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", user.profile.tenant_id)
    .eq("status", "voting_in_progress");
  return count ?? 0;
}

export async function queryPollingUnits(input: {
  state?: string;
  lga?: string;
  ward?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  mappedOnly?: boolean;
  unassignedOnly?: boolean;
}): Promise<{ rows: PollingUnitListItem[]; total: number }> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return { rows: [], total: 0 };
  const user = gate.user;

  const state = sanitizeFilter(input.state ?? "");
  const lga = sanitizeFilter(input.lga ?? "");
  const ward = sanitizeFilter(input.ward ?? "");
  const search = sanitizeFilter(input.search ?? "");

  // Nationwide: require state (or a search) so we never dump the full register.
  if (!state && search.length < 2) return { rows: [], total: 0 };

  const page = Math.max(0, input.page ?? 0);
  const pageSize = Math.min(Math.max(input.pageSize ?? 40, 1), 500);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let q = supabase.from("national_polling_units").select(LIST_COLS, { count: "exact" }).order("code");
  if (state) q = q.or(stateMatchOr(state));
  if (lga) q = q.eq("lga", lga);
  if (ward) q = q.eq("ward", ward);
  if (search.length >= 2) q = q.or(pollingUnitSearchOrFilter(search));
  if (input.mappedOnly) {
    q = q.not("latitude", "is", null).not("longitude", "is", null);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) {
    // Pre-migration fallback: tenant-local rows with state filter.
    let local = supabase
      .from("polling_units")
      .select(
        "id, name, code, pu_code, ward, lga, state, registered_voters, latitude, longitude, risk_level, ward_code, lg_code, state_code, geocode_status, address, assigned_agent_id",
        { count: "exact" }
      )
      .eq("tenant_id", user.profile.tenant_id)
      .order("code");
    if (state) local = local.or(stateMatchOr(state));
    if (lga) local = local.eq("lga", lga);
    if (ward) local = local.eq("ward", ward);
    if (search.length >= 2) local = local.or(pollingUnitSearchOrFilter(search));
    if (input.unassignedOnly) local = local.is("assigned_agent_id", null);
    const res = await local.range(from, to);
    const units = (res.data ?? []).map((row) => withDisplayCode(row as PollingUnitListItem));
    return { rows: units, total: res.count ?? units.length };
  }

  const units = (data ?? []).map((row) =>
    withDisplayCode({
      ...(row as PollingUnitListItem),
      risk_level: null as string | null,
      assigned_agent_id: null as string | null,
    })
  );

  // Overlay tenant assignment onto national rows by official code.
  const codes = units.map((u) => u.code);
  if (codes.length) {
    const { data: local } = await supabase
      .from("polling_units")
      .select("id, code, assigned_agent_id, risk_level")
      .eq("tenant_id", user.profile.tenant_id)
      .in("code", codes);
    const byCode = new Map((local ?? []).map((r) => [String(r.code).toUpperCase(), r]));
    const localIds = (local ?? []).map((r) => r.id);
    const statusMap = new Map<string, { status: string; turnout: number | null }>();
    if (localIds.length) {
      const { data: statuses } = await supabase
        .from("polling_unit_status")
        .select("polling_unit_id, status, turnout")
        .eq("tenant_id", user.profile.tenant_id)
        .in("polling_unit_id", localIds);
      for (const s of statuses ?? []) {
        statusMap.set(s.polling_unit_id, { status: s.status, turnout: s.turnout });
      }
    }
    const filtered: PollingUnitListItem[] = [];
    for (const unit of units) {
      const localRow = byCode.get(unit.code.toUpperCase());
      unit.assigned_agent_id = localRow?.assigned_agent_id ?? null;
      unit.risk_level = (localRow?.risk_level as string | null) ?? null;
      if (localRow) {
        const st = statusMap.get(localRow.id);
        unit.live_status = st?.status ?? "not_active";
        unit.turnout = st?.turnout ?? 0;
      } else {
        unit.live_status = "not_active";
        unit.turnout = 0;
      }
      if (input.unassignedOnly && unit.assigned_agent_id) continue;
      filtered.push(unit);
    }
    return { rows: filtered, total: count ?? filtered.length };
  }

  return { rows: units, total: count ?? units.length };
}

export async function getPollingUnit(id: string) {
  const supabase = await createClient();
  const { data: national } = await supabase.from("national_polling_units").select("*").eq("id", id).maybeSingle();
  if (national) {
    return { ...national, code: formatPollingUnitCode(national) } as Record<string, unknown>;
  }
  const row = await getRecord<Record<string, unknown>>("polling_units", id);
  if (!row) return row;
  return { ...row, code: formatPollingUnitCode(row as PollingUnitListItem) } as Record<string, unknown>;
}

export async function createPollingUnit(formData: FormData) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const writeBlocked = denyCreateIfRestricted(user.role);
  if (writeBlocked) return { error: writeBlocked };
  const stateName = String(formData.get("state") ?? "").trim() || "Edo";
  const parsed = parsePollingUnitCode(String(formData.get("code") ?? ""));
  const stateCode = String(formData.get("state_code") ?? "").trim() || parsed?.state || null;
  const supabase = await createClient();
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  const code = formatPollingUnitCode({
    code: String(formData.get("code") ?? ""),
    state: stateName,
    lga: String(formData.get("lga") ?? ""),
    ward: String(formData.get("ward") ?? ""),
    state_code: stateCode,
    lg_code: (formData.get("lg_code") as string) || null,
    ward_code: (formData.get("ward_code") as string) || null,
    pu_code: (formData.get("pu_code") as string) || null,
  });
  const payload = {
    tenant_id: user.profile.tenant_id,
    code,
    name: formData.get("name") as string,
    ward: formData.get("ward") as string,
    lga: formData.get("lga") as string,
    state: stateName,
    state_code: stateCode,
    lg_code: (formData.get("lg_code") as string) || null,
    ward_code: (formData.get("ward_code") as string) || null,
    pu_code: (formData.get("pu_code") as string) || null,
    registered_voters: formData.get("registered_voters") ? Number(formData.get("registered_voters")) : 0,
    latitude: lat,
    longitude: lng,
    address: (formData.get("address") as string) || null,
    risk_level: (formData.get("risk_level") as string) || "low",
    security_notes: (formData.get("security_notes") as string) || null,
    logistics: (formData.get("logistics") as string) || null,
    assigned_agent_id: (formData.get("assigned_agent_id") as string) || null,
    geocode_status: lat && lng ? "done" : "pending",
  };
  const { error } = await supabase.from("polling_units").insert(payload);
  if (error) return { error: error.message };
  await upsertPollingUnitRows(supabase, user.profile.tenant_id, [
    {
      code,
      name: payload.name,
      ward: payload.ward,
      lga: payload.lga,
      state: payload.state,
      pu_code: payload.pu_code,
      state_code: payload.state_code,
      lg_code: payload.lg_code,
      ward_code: payload.ward_code,
      registered_voters: payload.registered_voters,
      latitude: payload.latitude,
      longitude: payload.longitude,
      address: payload.address,
    },
  ]);
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true };
}

export async function updatePollingUnit(id: string, formData: FormData) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const writeBlocked = denyCreateIfRestricted(gate.user.role);
  if (writeBlocked) return { error: writeBlocked };
  const stateName = String(formData.get("state") ?? "").trim() || "Edo";
  const parsed = parsePollingUnitCode(String(formData.get("code") ?? ""));
  const stateCode = String(formData.get("state_code") ?? "").trim() || parsed?.state || null;
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  return updateRecord(
    "polling_units",
    id,
    {
      code: formatPollingUnitCode({
        code: String(formData.get("code") ?? ""),
        state: stateName,
        lga: String(formData.get("lga") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        state_code: stateCode,
        lg_code: (formData.get("lg_code") as string) || null,
        ward_code: (formData.get("ward_code") as string) || null,
        pu_code: (formData.get("pu_code") as string) || null,
      }),
      name: formData.get("name"),
      ward: formData.get("ward"),
      lga: formData.get("lga"),
      state: stateName,
      state_code: stateCode,
      lg_code: formData.get("lg_code") || null,
      ward_code: formData.get("ward_code") || null,
      pu_code: formData.get("pu_code") || null,
      registered_voters: formData.get("registered_voters") ? Number(formData.get("registered_voters")) : 0,
      latitude: lat,
      longitude: lng,
      address: formData.get("address") || null,
      risk_level: formData.get("risk_level") || "low",
      security_notes: formData.get("security_notes") || null,
      logistics: formData.get("logistics") || null,
      assigned_agent_id: formData.get("assigned_agent_id") || null,
      geocode_status: lat && lng ? "done" : "pending",
    },
    "/polling-units"
  );
}

export async function deletePollingUnit(id: string) {
  revalidatePath("/maps");
  return deleteRecord("polling_units", id, "/polling-units");
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getTeamForAssignment() {
  const limit = 500;
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { rows: [], truncated: false, limit };
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("tenant_id", gate.user.profile.tenant_id)
    .in("role", ["polling_agent", "polling_unit_supervisor", "ward_coordinator"])
    .order("full_name")
    .limit(limit + 1);

  const rows = data ?? [];
  return { rows: rows.slice(0, limit), truncated: rows.length > limit, limit };
}

export async function importPollingUnitsCsv(csvText: string) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const rows = parsePollingUnitsCsv(csvText);
  const supabase = await createClient();
  const { imported } = await upsertPollingUnitRows(supabase, user.profile.tenant_id, rows);
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true, imported };
}
