"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteRecord, getRecord, updateRecord } from "@/lib/modules/crud-actions";
import { parsePollingUnitsCsv } from "@/lib/polling-units/csv";
import { upsertPollingUnitRows } from "@/lib/polling-units/import-rows";

/** Supabase caps each response at 1,000 rows — page until exhausted. */
async function fetchAllRows<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function getPollingUnits(tenantId: string, filters?: { lga?: string; ward?: string; search?: string }) {
  const supabase = await createClient();
  return fetchAllRows(() => {
    let q = supabase
      .from("polling_units")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("lga")
      .order("ward")
      .order("name");
    if (filters?.lga) q = q.eq("lga", filters.lga);
    if (filters?.ward) q = q.eq("ward", filters.ward);
    if (filters?.search) {
      q = q.or(
        `code.ilike.%${filters.search}%,name.ilike.%${filters.search}%,pu_code.ilike.%${filters.search}%,ward.ilike.%${filters.search}%,lga.ilike.%${filters.search}%`
      );
    }
    return q;
  });
}

export async function getPollingUnitsWithStatus(tenantId: string) {
  const supabase = await createClient();
  type UnitRow = {
    id: string;
    name: string;
    code: string;
    ward: string;
    lga: string;
    state: string;
    [key: string]: unknown;
  };
  const [units, statuses] = await Promise.all([
    fetchAllRows<UnitRow>(() =>
      supabase
        .from("polling_units")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("lga")
        .order("ward")
        .order("name")
    ),
    fetchAllRows<{ polling_unit_id: string; status: string; turnout: number | null }>(() =>
      supabase
        .from("polling_unit_status")
        .select("polling_unit_id, status, turnout")
        .eq("tenant_id", tenantId)
    ),
  ]);
  const statusMap = new Map(statuses.map((s) => [s.polling_unit_id, s]));
  return units.map((u) => ({
    ...u,
    live_status: statusMap.get(u.id)?.status ?? "not_active",
    turnout: statusMap.get(u.id)?.turnout ?? 0,
  }));
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
  return getRecord<Record<string, unknown>>("polling_units", id);
}

export async function createPollingUnit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  const { error } = await supabase.from("polling_units").insert({
    tenant_id: user.profile.tenant_id,
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    ward: formData.get("ward") as string,
    lga: formData.get("lga") as string,
    state: (formData.get("state") as string) || "Edo",
    state_code: (formData.get("state_code") as string) || null,
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
  });
  if (error) return { error: error.message };
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true };
}

export async function updatePollingUnit(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const lat = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const lng = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  return updateRecord(
    "polling_units",
    id,
    {
      code: formData.get("code"),
      name: formData.get("name"),
      ward: formData.get("ward"),
      lga: formData.get("lga"),
      state: formData.get("state") || "Edo",
      state_code: formData.get("state_code") || null,
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
  const rows = parsePollingUnitsCsv(csvText);
  const supabase = await createClient();
  const { imported } = await upsertPollingUnitRows(supabase, user.profile.tenant_id, rows);
  revalidatePath("/polling-units");
  revalidatePath("/maps");
  return { success: true, imported };
}
