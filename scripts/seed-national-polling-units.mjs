#!/usr/bin/env node
/**
 * Load all 36 states + FCT from the public INEC polling-unit register
 * into shared `national_polling_units` (idempotent upsert by code).
 *
 * Usage:
 *   npm run pu:seed-national
 *   npm run pu:seed-national -- --states=KANO,LAGOS,FCT
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const statesArg = args.find((a) => a.startsWith("--states="))?.split("=")[1];
const states = statesArg
  ? statesArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : undefined;

// Ensure service client env is visible to seed module.
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${key}` } },
});

const { seedNationalPollingUnitsCatalog } = await import(
  "../src/lib/polling-units/seed-national.ts"
);

console.log(`Seeding national_polling_units from INEC register → ${url}`);
if (states?.length) console.log(`States filter: ${states.join(", ")}`);

const result = await seedNationalPollingUnitsCatalog({
  states,
  client: admin,
  onProgress: (p) => {
    console.log(
      `[${p.stateIndex}/${p.stateTotal}] ${p.state}: ${p.units.toLocaleString()} units (running upserted=${p.upserted.toLocaleString()} failed=${p.failed})`
    );
  },
});

console.log(
  `Done. states=${result.states} upserted=${result.upserted.toLocaleString()} failed=${result.failed}`
);
if (result.errors.length) {
  console.error("Errors:");
  for (const e of result.errors.slice(0, 20)) console.error(" -", e);
  if (result.errors.length > 20) console.error(` …and ${result.errors.length - 20} more`);
}

const { data: stateRows } = await admin.rpc("national_pu_states");
const stateNames = (stateRows ?? []).map((r) => r.state).filter(Boolean);
console.log(`Distinct states in catalog: ${stateNames.length}`);
for (const s of stateNames.sort((a, b) => a.localeCompare(b))) {
  const { count } = await admin
    .from("national_polling_units")
    .select("id", { count: "exact", head: true })
    .eq("state", s);
  console.log(`  ${s}: ${(count ?? 0).toLocaleString()}`);
}

if (result.failed) process.exit(1);
