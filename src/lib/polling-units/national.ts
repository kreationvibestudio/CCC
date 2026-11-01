import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/public-error";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { stateMatchOr } from "@/lib/polling-units/scope";

export type NationalPollingUnit = {
  id: string;
  code: string;
  pu_code: string | null;
  name: string;
  ward: string;
  lga: string;
  state: string;
  state_code: string | null;
  lg_code: string | null;
  ward_code: string | null;
  registered_voters: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  geocode_status: string | null;
};

const NATIONAL_COLS =
  "id, code, pu_code, name, ward, lga, state, state_code, lg_code, ward_code, registered_voters, latitude, longitude, address, geocode_status";

export function displayPuCode(row: { code?: string | null; pu_code?: string | null; name?: string | null }) {
  return formatPollingUnitCode(row);
}

/** Distinct states from the shared national catalog (falls back to tenant PUs). */
export async function listNationalStates(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("national_pu_states");
  if (!error && Array.isArray(data)) {
    return (data as Array<{ state: string }>)
      .map((r) => r.state)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  // Catalog migration not applied yet — read tenant-local distinct states without Edo gate.
  const names = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    const { data: rows } = await supabase
      .from("polling_units")
      .select("state")
      .not("state", "is", null)
      .order("code")
      .range(from, from + pageSize - 1);
    for (const row of rows ?? []) {
      if (row.state) names.add(String(row.state).trim());
    }
    if ((rows?.length ?? 0) < pageSize) break;
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function listNationalWards(state: string): Promise<Array<{ ward: string; lga: string }>> {
  const trimmed = state.trim();
  if (!trimmed) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("national_pu_wards", { p_state: trimmed });
  if (!error && Array.isArray(data)) {
    return (data as Array<{ ward: string; lga: string }>).filter((r) => r.ward && r.lga);
  }

  const pairs = new Map<string, { ward: string; lga: string }>();
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    const { data: rows } = await supabase
      .from("polling_units")
      .select("ward, lga")
      .or(stateMatchOr(trimmed))
      .not("ward", "is", null)
      .not("lga", "is", null)
      .order("code")
      .range(from, from + pageSize - 1);
    for (const row of rows ?? []) {
      if (!row.ward || !row.lga) continue;
      pairs.set(`${row.lga}::${row.ward}`, { ward: row.ward, lga: row.lga });
    }
    if ((rows?.length ?? 0) < pageSize) break;
  }
  return [...pairs.values()].sort(
    (a, b) => a.lga.localeCompare(b.lga) || a.ward.localeCompare(b.ward)
  );
}

export async function listNationalPollingUnits(input: {
  state: string;
  lga: string;
  ward: string;
}): Promise<NationalPollingUnit[]> {
  const state = input.state.trim();
  const lga = input.lga.trim();
  const ward = input.ward.trim();
  if (!state || !lga || !ward) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("national_pu_units", {
    p_state: state,
    p_lga: lga,
    p_ward: ward,
  });
  if (!error && Array.isArray(data)) {
    return data as NationalPollingUnit[];
  }

  const { data: rows } = await supabase
    .from("polling_units")
    .select(NATIONAL_COLS)
    .or(stateMatchOr(state))
    .eq("lga", lga)
    .eq("ward", ward)
    .order("code")
    .limit(2000);
  return (rows ?? []) as NationalPollingUnit[];
}

export async function listNationalStatesForLgas(state: string): Promise<string[]> {
  const trimmed = state.trim();
  if (!trimmed) return [];
  const wards = await listNationalWards(trimmed);
  return [...new Set(wards.map((w) => w.lga))].sort((a, b) => a.localeCompare(b));
}

export async function listNationalWardsInLga(state: string, lga: string): Promise<string[]> {
  const wards = await listNationalWards(state);
  const needle = lga.trim().toLowerCase();
  return [
    ...new Set(
      wards.filter((w) => w.lga.trim().toLowerCase() === needle).map((w) => w.ward)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/** Ensure tenant-local PU exists for assignment; returns local polling_units.id. */
export async function ensureTenantPollingUnitFromNational(input: {
  tenantId: string;
  nationalId: string;
}): Promise<{ id: string } | { error: string }> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("ensure_tenant_polling_unit", {
    p_tenant_id: input.tenantId,
    p_national_id: input.nationalId,
  });
  if (error) {
    if (isMissingRelationError(error.message, "national_polling_units")) {
      // Pre-migration: treat nationalId as already-local.
      return { id: input.nationalId };
    }
    return { error: error.message };
  }
  if (!data) return { error: "Could not materialize polling unit for this workspace" };
  return { id: String(data) };
}

export async function getNationalPollingUnit(id: string): Promise<NationalPollingUnit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("national_polling_units")
    .select(NATIONAL_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!error && data) return data as NationalPollingUnit;

  const { data: local } = await supabase
    .from("polling_units")
    .select(NATIONAL_COLS)
    .eq("id", id)
    .maybeSingle();
  return (local as NationalPollingUnit | null) ?? null;
}

/** Upsert imported / synced rows into the national catalog (service role). */
export async function upsertNationalPollingUnits(
  rows: Array<{
    code: string;
    name: string;
    ward: string;
    lga: string;
    state: string;
    pu_code?: string | null;
    state_code?: string | null;
    lg_code?: string | null;
    ward_code?: string | null;
    registered_voters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    geocode_status?: string | null;
  }>
): Promise<{ upserted: number; error?: string }> {
  if (rows.length === 0) return { upserted: 0 };
  const admin = createServiceClient();
  const payload = rows.map((r) => ({
    code: r.code.trim(),
    name: r.name.trim(),
    ward: r.ward.trim(),
    lga: r.lga.trim(),
    state: r.state.trim(),
    pu_code: r.pu_code ?? null,
    state_code: r.state_code ?? null,
    lg_code: r.lg_code ?? null,
    ward_code: r.ward_code ?? null,
    registered_voters: r.registered_voters ?? 0,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    address: r.address ?? null,
    geocode_status: r.geocode_status ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await admin
    .from("national_polling_units")
    .upsert(payload, { onConflict: "code" })
    .select("id");
  if (error) {
    if (isMissingRelationError(error.message, "national_polling_units")) {
      return { upserted: 0, error: "National catalog missing. Run migration 20261031230000." };
    }
    return { upserted: 0, error: error.message };
  }
  return { upserted: data?.length ?? payload.length };
}
