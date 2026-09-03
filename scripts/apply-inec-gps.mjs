#!/usr/bin/env node
/**
 * Apply official INEC CVR GPS CSV onto polling_units (replaces LGA-centroid approx pins).
 *
 *   npm run pu:apply-gps
 *   npm run pu:apply-gps -- --force --all
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : all ? 500 : 200;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { applyInecGpsForTenant } = await import("../src/lib/polling-units/inec-cvr-gps.ts");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalUpdated = 0;
let offset = 0;
for (let i = 0; i < 40; i += 1) {
  const result = await applyInecGpsForTenant(supabase, tenantId, {
    limit,
    force,
    offset,
  });
  totalUpdated += result.updated;
  offset = result.nextOffset;
  console.log(
    `batch ${i + 1}: updated=${result.updated} skipped=${result.skipped} remainingApprox=${result.remainingApprox} catalog=${result.catalog} nextOffset=${result.nextOffset}`
  );
  if (result.samples?.length) {
    for (const s of result.samples.slice(0, 3)) {
      console.log(`  ${s.code} → ${s.lat}, ${s.lng}`);
    }
  }
  if (result.errors?.length) console.log("  errors:", result.errors.join("; "));
  if (result.nextOffset >= result.catalog) break;
}

console.log(`Done. Updated ${totalUpdated} pins.`);
