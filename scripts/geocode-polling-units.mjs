#!/usr/bin/env node
/**
 * Fill missing polling-unit coordinates.
 *
 * Uses Google or Mapbox when those keys are set; otherwise Photon then Nominatim.
 * Queries are built from each row's name/ward/LGA/state — never hardcoded to Edo.
 *
 * Usage:
 *   npm run pu:geocode
 *   npm run pu:geocode -- --all
 *   npm run pu:geocode -- --limit=25 --retry-failed
 *   npm run pu:geocode -- --dry-run --code=FC/06/04/028
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const codeArg = args.find((a) => a.startsWith("--code="))?.split("=")[1];
const all = args.includes("--all");
const retryFailed = args.includes("--retry-failed");
const dryRun = args.includes("--dry-run");
const limit = limitArg ? parseInt(limitArg, 10) : all ? 25 : 10;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { buildGeocodeQueries, geocodePollingUnit } = await import("../src/lib/polling-units/geocode.ts");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function counts() {
  const [{ count: total }, { count: mapped }, { count: remaining }] = await Promise.all([
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
  ]);
  return { total: total ?? 0, mapped: mapped ?? 0, remaining: remaining ?? 0 };
}

async function geocodeBatch() {
  let query = supabase
    .from("polling_units")
    .select("id, code, name, address, ward, lga, state")
    .eq("tenant_id", tenantId)
    .or("latitude.is.null,longitude.is.null")
    .order("code")
    .limit(limit);
  if (!retryFailed) {
    query = query.or("geocode_status.is.null,geocode_status.eq.pending,geocode_status.eq.done");
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const units = data ?? [];
  let geocoded = 0;
  let failed = 0;
  for (const unit of units) {
    const hit = await geocodePollingUnit(unit);
    if (hit) {
      const { error: updateError } = await supabase
        .from("polling_units")
        .update({ latitude: hit.lat, longitude: hit.lng, geocode_status: "done" })
        .eq("id", unit.id)
        .eq("tenant_id", tenantId);
      if (updateError) {
        failed += 1;
        console.log(`  ✗ ${unit.code} — update failed: ${updateError.message}`);
        continue;
      }
      geocoded += 1;
      console.log(`  ✓ ${unit.code} → ${hit.lat}, ${hit.lng}  [${hit.provider}] ${hit.label}`);
    } else {
      await supabase.from("polling_units").update({ geocode_status: "failed" }).eq("id", unit.id).eq("tenant_id", tenantId);
      failed += 1;
      console.log(`  ✗ ${unit.code} — ${unit.name}`);
    }
  }
  const after = await counts();
  return { processed: units.length, geocoded, failed, ...after };
}

async function main() {
  if (dryRun && codeArg) {
    const { data, error } = await supabase
      .from("polling_units")
      .select("code, name, address, ward, lga, state")
      .eq("tenant_id", tenantId)
      .or(`code.eq.${codeArg},pu_code.eq.${codeArg}`)
      .maybeSingle();
    if (error || !data) {
      console.error(error?.message ?? `No polling unit ${codeArg}`);
      process.exit(1);
    }
    console.log("Queries:");
    for (const q of buildGeocodeQueries(data)) console.log(`  - ${q}`);
    const hit = await geocodePollingUnit(data);
    console.log(
      hit
        ? `Hit: ${hit.lat}, ${hit.lng} (${hit.provider}, score ${hit.score})\n  ${hit.label}\n  via ${hit.query}`
        : "No hit"
    );
    return;
  }

  let remaining = Infinity;
  let loops = 0;
  const maxLoops = all ? 5000 : 1;
  while (loops < maxLoops && remaining > 0) {
    const result = await geocodeBatch();
    loops += 1;
    remaining = result.remaining;
    console.log(
      `Batch ${loops}: processed ${result.processed}, pinned ${result.geocoded}, failed ${result.failed}, remaining ${result.remaining}/${result.total}`
    );
    if (!all || result.processed === 0) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
