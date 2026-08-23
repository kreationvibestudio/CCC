import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectGeocodeProviders,
  geocodePollingUnit,
  type GeocodeHit,
  type GeocodeProviderName,
} from "./geocode";

export type PendingGeocodeUnit = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  ward: string;
  lga: string;
  state: string;
};

export type GeocodeSample = {
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: "done" | "failed";
  provider?: string;
  query?: string;
  score?: number;
};

export type GeocodeBatchResult = {
  processed: number;
  geocoded: number;
  failed: number;
  remaining: number;
  mapped: number;
  total: number;
  provider: GeocodeProviderName;
  samples: GeocodeSample[];
};

const UNIT_COLS = "id, code, name, address, ward, lga, state";

export function geocodeBatchLimit(providers?: GeocodeProviderName[]) {
  const primary = (providers ?? detectGeocodeProviders())[0];
  if (primary === "nominatim") return 6;
  if (primary === "google" || primary === "mapbox") return 15;
  return 10;
}

export async function countPollingUnitPins(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ total: number; mapped: number; remaining: number; failed: number }> {
  const [{ count: total }, { count: mapped }, { count: remaining }, { count: failed }] = await Promise.all([
    supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    supabase
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .or("latitude.is.null,longitude.is.null"),
    supabase
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("geocode_status", "failed")
      .or("latitude.is.null,longitude.is.null"),
  ]);
  return {
    total: total ?? 0,
    mapped: mapped ?? 0,
    remaining: remaining ?? 0,
    failed: failed ?? 0,
  };
}

export async function geocodePendingForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  options?: {
    limit?: number;
    retryFailed?: boolean;
    providers?: GeocodeProviderName[];
  }
): Promise<GeocodeBatchResult> {
  const providers = options?.providers?.length ? options.providers : detectGeocodeProviders();
  const limit = Math.min(Math.max(options?.limit ?? geocodeBatchLimit(providers), 1), 40);
  const counts = await countPollingUnitPins(supabase, tenantId);

  let query = supabase
    .from("polling_units")
    .select(UNIT_COLS)
    .eq("tenant_id", tenantId)
    .or("latitude.is.null,longitude.is.null")
    .order("code")
    .limit(limit);

  if (!options?.retryFailed) {
    query = query.or("geocode_status.is.null,geocode_status.eq.pending,geocode_status.eq.done");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const units = (data ?? []) as PendingGeocodeUnit[];
  const samples: GeocodeSample[] = [];
  let geocoded = 0;
  let failed = 0;

  for (const unit of units) {
    const hit: GeocodeHit | null = await geocodePollingUnit(unit, { providers });
    if (hit) {
      const { error: updateError } = await supabase
        .from("polling_units")
        .update({
          latitude: hit.lat,
          longitude: hit.lng,
          geocode_status: "done",
        })
        .eq("id", unit.id)
        .eq("tenant_id", tenantId);
      if (updateError) {
        failed += 1;
        samples.push({ code: unit.code, name: unit.name, lat: null, lng: null, status: "failed" });
        continue;
      }
      geocoded += 1;
      samples.push({
        code: unit.code,
        name: unit.name,
        lat: hit.lat,
        lng: hit.lng,
        status: "done",
        provider: hit.provider,
        query: hit.query,
        score: hit.score,
      });
    } else {
      await supabase
        .from("polling_units")
        .update({ geocode_status: "failed" })
        .eq("id", unit.id)
        .eq("tenant_id", tenantId);
      failed += 1;
      samples.push({ code: unit.code, name: unit.name, lat: null, lng: null, status: "failed" });
    }
  }

  const after = await countPollingUnitPins(supabase, tenantId);
  return {
    processed: units.length,
    geocoded,
    failed,
    remaining: after.remaining,
    mapped: after.mapped,
    total: after.total,
    provider: providers[0] ?? "nominatim",
    samples,
  };
}
