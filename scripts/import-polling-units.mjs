#!/usr/bin/env node
/**
 * Import INEC polling units from CSV into Supabase.
 * Usage: node scripts/import-polling-units.mjs [csv-path] [--tenant-id=UUID]
 *
 * INEC columns: state, lg, ward, state_code, lg_code, ward_code, pu_code, code, location, ward_des, lg_des
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV = join(ROOT, "supabase/data/edo-polling-units.csv");
const DEFAULT_TENANT = "a0000000-0000-0000-0000-000000000001";

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

function normalizeRow(raw) {
  const state = raw.state?.trim() || "Edo";
  const stateCode = raw.state_code?.trim() || null;
  const lgCode = raw.lg_code?.trim() || raw.lg?.trim() || null;
  const wardCode = raw.ward_code?.trim() || null;
  const puCode = raw.pu_code?.trim() || null;

  let code = raw.code?.trim();
  if (!code && stateCode && lgCode && wardCode && puCode) {
    code = `${stateCode}/${lgCode}/${wardCode}/${puCode}`;
  }
  if (!code) return null;

  const location = raw.location?.trim() || raw.name?.trim() || code;
  return {
    tenant_id: null,
    code,
    name: location,
    ward: raw.ward_des?.trim() || raw.ward?.trim() || "",
    lga: raw.lg_des?.trim() || raw.lga?.trim() || raw.lg?.trim() || "",
    state,
    state_code: stateCode,
    lg_code: lgCode,
    ward_code: wardCode || raw.ward?.trim() || null,
    pu_code: puCode,
    registered_voters: raw.registered_voters ? parseInt(raw.registered_voters, 10) : 0,
    latitude: raw.latitude ? parseFloat(raw.latitude) : null,
    longitude: raw.longitude ? parseFloat(raw.longitude) : null,
    address: raw.address?.trim() || location,
    geocode_status: raw.latitude && raw.longitude ? "done" : "pending",
    risk_level: "low",
  };
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const raw = {};
    header.forEach((h, i) => {
      raw[h] = (vals[i] ?? "").trim();
    });
    const row = normalizeRow(raw);
    if (row) rows.push(row);
  }
  return rows;
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

  const BATCH = 100;
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => ({ ...row, tenant_id: tenantId }));
    const res = await fetch(`${url}/rest/v1/polling_units?on_conflict=tenant_id,code`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });

    if (res.ok) {
      ok += chunk.length;
      console.log(`  ✓ ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    } else {
      // Fall back to per-row so one bad record doesn't block the batch
      const err = await res.text();
      console.warn(`  batch failed (${err.slice(0, 100)}); retrying row-by-row…`);
      for (const body of chunk) {
        const one = await fetch(`${url}/rest/v1/polling_units?on_conflict=tenant_id,code`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(body),
        });
        if (one.ok) ok++;
        else {
          fail++;
          console.error(`  ✗ ${body.code}: ${(await one.text()).slice(0, 120)}`);
        }
      }
    }
  }

  console.log(`\nDone: ${ok} imported, ${fail} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
