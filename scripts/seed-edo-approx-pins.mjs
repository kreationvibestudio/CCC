#!/usr/bin/env node
/**
 * Fill missing Edo polling-unit map pins from LGA centroids + deterministic jitter.
 * INEC CSV has names, not GPS; public geocoders are slow/noisy for 4k+ units.
 * These pins are good enough for Field Agent check-in (5 km radius).
 *
 * Usage: node scripts/seed-edo-approx-pins.mjs [--tenant-id=UUID] [--force]
 */
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const DEFAULT_TENANT = "a0000000-0000-0000-0000-000000000001";

/** Approximate LGA centroids for Edo State (WGS84). */
const LGA_CENTROIDS = {
  "akoko edo": [7.295, 6.105],
  "akoko-edo": [7.295, 6.105],
  egor: [6.365, 5.605],
  "esan central": [6.74, 6.2],
  "esan north east": [6.72, 6.33],
  "esan north-east": [6.72, 6.33],
  "esan south east": [6.55, 6.35],
  "esan south-east": [6.55, 6.35],
  "esan west": [6.7, 6.2],
  "etsako central": [7.05, 6.35],
  "etsako east": [7.15, 6.5],
  "etsako west": [7.0, 6.25],
  igueben: [6.6, 6.25],
  "ikpoba okha": [6.3, 5.7],
  "ikpoba-okha": [6.3, 5.7],
  oredo: [6.335, 5.627],
  orhionmwon: [6.2, 5.85],
  "ovia north east": [6.45, 5.55],
  "ovia north-east": [6.45, 5.55],
  "ovia south west": [6.4, 5.35],
  "ovia south-west": [6.4, 5.35],
  "owan east": [7.05, 6.05],
  "owan west": [6.95, 5.95],
  uhunmwonde: [6.5, 5.85],
};

const STATE_FALLBACK = [6.335, 5.627]; // Benin City

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function pinFor(row) {
  const key = norm(row.lga);
  const base = LGA_CENTROIDS[key] || STATE_FALLBACK;
  const seed = `${row.code}|${row.ward}|${row.name}`;
  const a = hash01(seed);
  const b = hash01(seed + "|b");
  // ~±4 km jitter so nearby PUs don't share one point, still within check-in radius of LGA hub
  const dLat = (a - 0.5) * 0.07;
  const dLng = (b - 0.5) * 0.07;
  return {
    latitude: Number((base[0] + dLat).toFixed(6)),
    longitude: Number((base[1] + dLng).toFixed(6)),
    geocode_status: "done",
  };
}

async function main() {
  const args = process.argv.slice(2);
  const tenantId =
    args.find((a) => a.startsWith("--tenant-id="))?.split("=")[1] ??
    process.env.TENANT_ID ??
    DEFAULT_TENANT;
  const force = args.includes("--force");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const page = 1000;
  let updated = 0;
  let skipped = 0;
  let pass = 0;

  // When filtering nulls, always fetch offset 0 — patched rows leave the result set.
  for (;;) {
    pass += 1;
    const filter = force
      ? `&order=code&limit=${page}&offset=${(pass - 1) * page}`
      : `&or=(latitude.is.null,longitude.is.null)&order=code&limit=${page}`;
    const res = await fetch(
      `${url}/rest/v1/polling_units?select=id,code,name,ward,lga,latitude,longitude&tenant_id=eq.${tenantId}${filter}`,
      { headers }
    );
    if (!res.ok) {
      console.error(await res.text());
      process.exit(1);
    }
    const rows = await res.json();
    if (!rows.length) break;

    for (const row of rows) {
      if (!force && row.latitude != null && row.longitude != null) {
        skipped++;
        continue;
      }
      const pin = pinFor(row);
      const patch = await fetch(`${url}/rest/v1/polling_units?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(pin),
      });
      if (!patch.ok) {
        console.error(`fail ${row.code}:`, await patch.text());
      } else {
        updated++;
      }
    }

    console.log(`  … pass ${pass}: ${rows.length} rows, ${updated} pinned so far`);
    if (force && rows.length < page) break;
  }

  console.log(`Done: ${updated} pins set, ${skipped} already had coordinates`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
