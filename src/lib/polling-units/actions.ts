"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
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

export async function getPollingUnitLgas(): Promise<string[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await applyCampaignStateFilter(
    supabase.from("polling_units").select("lga").eq("tenant_id", user.profile.tenant_id)
  )
    .not("lga", "is", null)
    .limit(10000);
  const names = [...new Set((data ?? []).map((row) => row.lga).filter(Boolean) as string[])];
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

export async function getPollingUnitWards(lga: string): Promise<string[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const trimmed = lga.trim();
  if (!user || !trimmed) return [];
  const { data } = await applyCampaignStateFilter(
    supabase.from("polling_units").select("ward").eq("tenant_id", user.profile.tenant_id).eq("lga", trimmed)
  )
    .not("ward", "is", null)
    .limit(10000);
  const names = [...new Set((data ?? []).map((row) => row.ward).filter(Boolean) as string[])];
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

export async function getPollingUnitSummary(filters?: {
  lga?: string;
  ward?: string;
}): Promise<PollingUnitSummary> {
  const user = await getCurrentUser();
  if (!user) return { puCount: 0, registeredVoters: 0, mapped: 0 };
  const supabase = await createClient();
  let base = applyCampaignStateFilter(
    supabase.from("polling_units").select("id, registered_voters, latitude, longitude").eq("tenant_id", user.profile.tenant_id)
  );
  if (filters?.lga) base = base.eq("lga", filters.lga);
  if (filters?.ward) base = base.eq("ward", filters.ward);
  const { data } = await base.limit(10000);
  const rows = data ?? [];
  return {
    puCount: rows.length,
    registeredVoters: rows.reduce((sum, row) => sum + Number(row.registered_voters ?? 0), 0),
    mapped: rows.filter((row) => row.latitude != null && row.longitude != null).length,
  };
}

export async function countVotingActive(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
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
  const user = await getCurrentUser();
  if (!user) return { rows: [], total: 0 };

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

export async function getPollingUnitStatuses(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polling_unit_status")
    .select("*, polling_units(name, ward, lga, latitude, longitude, registered_voters, code)")
    .eq("tenant_id", tenantId);
  return data ?? [];
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
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
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
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
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

export async function getTeamForAssignment(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("tenant_id", tenantId)
    .in("role", ["polling_agent", "polling_unit_supervisor", "ward_coordinator"]);
  return data ?? [];
}

export async function getCampaignLocations(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("campaign_locations").select("*").eq("tenant_id", tenantId);
  return data ?? [];
}

export async function importPollingUnitsCsv(csvText: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const rows = parsePollingUnitsCsv(csvText).filter((row) => isCampaignPollingUnit(row));
  const supabase = await createClient();
  const { imported } = await upsertPollingUnitRows(supabase, user.profile.tenant_id, rows);
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true, imported };
}
