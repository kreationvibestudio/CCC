"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { deleteRecord, getRecord, updateRecord } from "@/lib/modules/crud-actions";
import { parsePollingUnitsCsv } from "@/lib/polling-units/csv";
import { upsertPollingUnitRows } from "@/lib/polling-units/import-rows";
import { formatPollingUnitCode, parsePollingUnitCode, withDisplayCode } from "@/lib/polling-units/code";
import { pollingUnitSearchOrFilter } from "@/lib/polling-units/lookup";
import {
  applyCampaignStateFilter,
  CAMPAIGN_STATE,
  CAMPAIGN_STATE_CODE,
  isCampaignPollingUnit,
  isCampaignState,
} from "@/lib/polling-units/scope";

const LIST_COLS =
  "id, name, code, pu_code, ward, lga, state, registered_voters, latitude, longitude, risk_level, ward_code, lg_code, state_code, geocode_status, address, assigned_agent_id";

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

async function listCampaignNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  column: "lga" | "ward",
  lga?: string
): Promise<string[]> {
  const names = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase.from("polling_units").select(column).eq("tenant_id", tenantId)
    )
      .not(column, "is", null)
      .order("code");
    if (lga) q = q.eq("lga", lga);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = (data ?? []) as Array<Record<string, string | null>>;
    for (const row of rows) {
      const value = row[column];
      if (value) names.add(value);
    }
    if (rows.length < pageSize) break;
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function getPollingUnitLgas(): Promise<string[]> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  return listCampaignNames(supabase, gate.user.profile.tenant_id, "lga");
}

export async function getPollingUnitWards(lga: string): Promise<string[]> {
  const trimmed = lga.trim();
  if (!trimmed) return [];
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  return listCampaignNames(supabase, gate.user.profile.tenant_id, "ward", trimmed);
}

export async function getPollingUnitSummary(filters?: {
  lga?: string;
  ward?: string;
}): Promise<PollingUnitSummary> {
  const gate = await authorize("polling_units.view");
  if (!gate.ok) return { puCount: 0, registeredVoters: 0, mapped: 0 };
  const user = gate.user;
  const supabase = await createClient();

  let countQuery = applyCampaignStateFilter(
    supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", user.profile.tenant_id)
  );
  let mappedQuery = applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.profile.tenant_id)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
  );
  if (filters?.lga) {
    countQuery = countQuery.eq("lga", filters.lga);
    mappedQuery = mappedQuery.eq("lga", filters.lga);
  }
  if (filters?.ward) {
    countQuery = countQuery.eq("ward", filters.ward);
    mappedQuery = mappedQuery.eq("ward", filters.ward);
  }
  const [{ count: puCount }, { count: mapped }] = await Promise.all([countQuery, mappedQuery]);
  let registeredVoters = 0;
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase.from("polling_units").select("registered_voters").eq("tenant_id", user.profile.tenant_id)
    ).order("code");
    if (filters?.lga) q = q.eq("lga", filters.lga);
    if (filters?.ward) q = q.eq("ward", filters.ward);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = data ?? [];
    registeredVoters += rows.reduce((sum, row) => sum + Number(row.registered_voters ?? 0), 0);
    if (rows.length < pageSize) break;
  }
  return { puCount: puCount ?? 0, registeredVoters, mapped: mapped ?? 0 };
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

  const lga = sanitizeFilter(input.lga ?? "");
  const ward = sanitizeFilter(input.ward ?? "");
  const search = sanitizeFilter(input.search ?? "");

  const page = Math.max(0, input.page ?? 0);
  const pageSize = Math.min(Math.max(input.pageSize ?? 40, 1), 500);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let q = applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select(LIST_COLS, { count: "exact" })
      .eq("tenant_id", user.profile.tenant_id)
  ).order("code");
  if (lga) q = q.eq("lga", lga);
  if (ward) q = q.eq("ward", ward);
  if (search.length >= 2) {
    q = q.or(pollingUnitSearchOrFilter(search));
  }
  if (input.mappedOnly) {
    q = q.not("latitude", "is", null).not("longitude", "is", null);
  }
  if (input.unassignedOnly) {
    q = q.is("assigned_agent_id", null);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) return { rows: [], total: 0 };

  const units = (data ?? []).map((row) => withDisplayCode(row as PollingUnitListItem));
  const ids = units.map((u) => u.id);
  if (ids.length) {
    const { data: statuses } = await supabase
      .from("polling_unit_status")
      .select("polling_unit_id, status, turnout")
      .eq("tenant_id", user.profile.tenant_id)
      .in("polling_unit_id", ids);
    const statusMap = new Map((statuses ?? []).map((s) => [s.polling_unit_id, s]));
    for (const unit of units) {
      unit.live_status = statusMap.get(unit.id)?.status ?? "not_active";
      unit.turnout = statusMap.get(unit.id)?.turnout ?? 0;
    }
  }
  return { rows: units, total: count ?? units.length };
}

export async function getPollingUnit(id: string) {
  const row = await getRecord<Record<string, unknown>>("polling_units", id);
  if (!row) return row;
  return { ...row, code: formatPollingUnitCode(row as PollingUnitListItem) } as Record<string, unknown>;
}

function edoOnlyFormError(formData: FormData): string | null {
  const parsed = parsePollingUnitCode(String(formData.get("code") ?? ""));
  if (parsed?.state && !isCampaignState(parsed.state)) {
    return "Polling units are confined to Edo State";
  }
  const stateCode = String(formData.get("state_code") ?? "").trim();
  if (stateCode && !isCampaignState(stateCode)) {
    return "Polling units are confined to Edo State";
  }
  const stateName = String(formData.get("state") ?? "").trim();
  if (stateName && !isCampaignState(stateName)) {
    return "Polling units are confined to Edo State";
  }
  return null;
}

export async function createPollingUnit(formData: FormData) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = edoOnlyFormError(formData);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  const payload = {
    tenant_id: user.profile.tenant_id,
    code: formatPollingUnitCode({
      code: String(formData.get("code") ?? ""),
      state: CAMPAIGN_STATE,
      lga: String(formData.get("lga") ?? ""),
      ward: String(formData.get("ward") ?? ""),
      state_code: CAMPAIGN_STATE_CODE,
      lg_code: (formData.get("lg_code") as string) || null,
      ward_code: (formData.get("ward_code") as string) || null,
      pu_code: (formData.get("pu_code") as string) || null,
    }),
    name: formData.get("name") as string,
    ward: formData.get("ward") as string,
    lga: formData.get("lga") as string,
    state: CAMPAIGN_STATE,
    state_code: CAMPAIGN_STATE_CODE,
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
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true };
}

export async function updatePollingUnit(id: string, formData: FormData) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = edoOnlyFormError(formData);
  if (blocked) return { error: blocked };
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  return updateRecord(
    "polling_units",
    id,
    {
      code: formatPollingUnitCode({
        code: String(formData.get("code") ?? ""),
        state: CAMPAIGN_STATE,
        lga: String(formData.get("lga") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        state_code: CAMPAIGN_STATE_CODE,
        lg_code: (formData.get("lg_code") as string) || null,
        ward_code: (formData.get("ward_code") as string) || null,
        pu_code: (formData.get("pu_code") as string) || null,
      }),
      name: formData.get("name"),
      ward: formData.get("ward"),
      lga: formData.get("lga"),
      state: CAMPAIGN_STATE,
      state_code: CAMPAIGN_STATE_CODE,
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
  // Feeds an assignment <select>, so it has to be a bounded list.
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
  // A workspace with one agent per polling unit has thousands of them, and an
  // unbounded read would silently stop at PostgREST's cap with no way to tell.
  return { rows: rows.slice(0, limit), truncated: rows.length > limit, limit };
}

export async function importPollingUnitsCsv(csvText: string) {
  const gate = await authorize("polling_units.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const rows = parsePollingUnitsCsv(csvText).filter((row) => isCampaignPollingUnit(row));
  const supabase = await createClient();
  const { imported } = await upsertPollingUnitRows(supabase, user.profile.tenant_id, rows);
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true, imported };
}
