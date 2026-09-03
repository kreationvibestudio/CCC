import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectGeocodeProviders,
  geocodePollingUnit,
  type GeocodeHit,
  type GeocodeProviderName,
} from "./geocode";
import { applyCampaignStateFilter } from "./scope.ts";
import { approxPinForPollingUnit } from "./approx-pins.ts";

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<boolean>) {
  let cursor = 0;
  let ok = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      if (await fn(items[index])) ok += 1;
    }
  });
  await Promise.all(workers);
  return ok;
}

async function patchPin(
  supabase: SupabaseClient,
  tenantId: string,
  id: string,
  latitude: number,
  longitude: number
) {
  const withStatus = await supabase
    .from("polling_units")
    .update({ latitude, longitude, geocode_status: "done" })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (!withStatus.error) return true;

  // Older DBs may lack geocode_status — retry coords only.
  if (/geocode_status/i.test(withStatus.error.message)) {
    const coordsOnly = await supabase
      .from("polling_units")
      .update({ latitude, longitude })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    return !coordsOnly.error;
  }
  return false;
}

/**
 * Fast approx pins for unmapped campaign PUs (LGA centroids + jitter).
 * Parallel updates so Vercel serverless does not time out on hundreds of units.
 */
export async function fillApproxPinsForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number }
): Promise<{ updated: number; remaining: number; mapped: number; total: number; errors: string[] }> {
  const limit = Math.min(Math.max(options?.limit ?? 250, 1), 400);
  const { data, error } = await applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select("id, code, name, ward, lga")
      .eq("tenant_id", tenantId)
      .or("latitude.is.null,longitude.is.null")
      .order("code")
      .limit(limit)
  );
  if (error) throw new Error(`Could not load unmapped PUs: ${error.message}`);

  const rows = data ?? [];
  const errors: string[] = [];
  const updated = await mapPool(rows, 40, async (row) => {
    const pin = approxPinForPollingUnit(row);
    const ok = await patchPin(supabase, tenantId, row.id, pin.latitude, pin.longitude);
    if (!ok) errors.push(row.code ?? row.id);
    return ok;
  });

  const counts = await countPollingUnitPins(supabase, tenantId);
  return {
    updated,
    remaining: counts.remaining,
    mapped: counts.mapped,
    total: counts.total,
    errors: errors.slice(0, 8),
  };
}

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
  provider: GeocodeProviderName | "approx";
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
    applyCampaignStateFilter(
      supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
    ),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .or("latitude.is.null,longitude.is.null")
    ),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("geocode_status", "failed")
        .or("latitude.is.null,longitude.is.null")
    ),
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

  let query = applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select(UNIT_COLS)
      .eq("tenant_id", tenantId)
      .or("latitude.is.null,longitude.is.null")
  ).order("code").limit(limit);

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
