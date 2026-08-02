#!/usr/bin/env node
/**
 * Import INEC polling units from CSV into Supabase.
 * Usage: node scripts/import-polling-units.mjs [csv-path] [--tenant-id=UUID]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
 * CSV columns: code, name, ward, lga, registered_voters, latitude, longitude, address
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV = join(ROOT, "supabase/data/edo-esan-polling-units.csv");
const DEFAULT_TENANT = "a0000000-0000-0000-0000-000000000001";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    header.forEach((h, i) => {
      row[h] = (vals[i] ?? "").trim();
    });
    return row;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CSV;
  const tenantArg = args.find((a) => a.startsWith("--tenant-id="));
  const tenantId = tenantArg?.split("=")[1] ?? process.env.TENANT_ID ?? DEFAULT_TENANT;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Importing ${rows.length} polling units for tenant ${tenantId}…`);

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const lat = row.latitude ? parseFloat(row.latitude) : null;
    const lng = row.longitude ? parseFloat(row.longitude) : null;
    const body = {
      tenant_id: tenantId,
      code: row.code,
      name: row.name,
      ward: row.ward,
      lga: row.lga,
      state: "Edo",
      registered_voters: row.registered_voters ? parseInt(row.registered_voters, 10) : 0,
      latitude: lat,
      longitude: lng,
      address: row.address || null,
      geocode_status: lat && lng ? "done" : "pending",
      risk_level: "low",
    };

    const res = await fetch(`${url}/rest/v1/polling_units?on_conflict=tenant_id,code`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      ok++;
      console.log(`  ✓ ${row.code}`);
    } else {
      fail++;
      const err = await res.text();
      console.error(`  ✗ ${row.code}: ${err.slice(0, 120)}`);
    }
  }

  console.log(`\nDone: ${ok} imported, ${fail} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
