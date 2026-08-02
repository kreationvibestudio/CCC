#!/usr/bin/env node
/**
 * Batch geocode polling units missing coordinates via OpenStreetMap Nominatim.
 * Usage: node scripts/geocode-polling-units.mjs [--limit=10]
 * Rate limit: 1 req/sec (Nominatim policy)
 */

import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const limit = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "10", 10);

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(query) {
  const q = encodeURIComponent(query);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "CampaignCommandCenter/1.0" } }
  );
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  return null;
}

async function main() {
  const res = await fetch(
    `${url}/rest/v1/polling_units?tenant_id=eq.${tenantId}&or=(geocode_status.eq.pending,latitude.is.null)&limit=${limit}&select=id,code,name,ward,lga`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const units = await res.json();
  console.log(`Geocoding ${units.length} units…`);

  for (const u of units) {
    const query = `${u.name}, ${u.ward}, ${u.lga}, Edo, Nigeria`;
    const coords = await geocode(query);
    await sleep(1100);

    if (coords) {
      await fetch(`${url}/rest/v1/polling_units?id=eq.${u.id}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          geocode_status: "done",
        }),
      });
      console.log(`  ✓ ${u.code} → ${coords.lat}, ${coords.lng}`);
    } else {
      await fetch(`${url}/rest/v1/polling_units?id=eq.${u.id}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ geocode_status: "failed" }),
      });
      console.log(`  ✗ ${u.code} — not found`);
    }
  }
}

main().catch(console.error);
