#!/usr/bin/env node
/**
 * Load official Edo INEC polling units and remove every other state.
 *
 * Usage:
 *   npm run pu:sync-inec
 *   npm run pu:sync-inec -- --limit=400
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : 2000;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { CAMPAIGN_STATE } = await import("../src/lib/polling-units/scope.ts");
const { syncInecRegisterBatch } = await import("../src/lib/polling-units/inec-sync.ts");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let offset = 0;
let inserted = 0;
let updated = 0;
let failed = 0;
let pruned = 0;
let pruneOnly = false;

console.log(`Syncing ${CAMPAIGN_STATE} INEC register into tenant ${tenantId} from ${url}`);

for (;;) {
  const result = await syncInecRegisterBatch(supabase, tenantId, {
    state: CAMPAIGN_STATE,
    offset,
    limit,
    pruneOnly,
  });
  inserted += result.inserted;
  updated += result.updated;
  failed += result.failed;
  pruned += result.pruned;
  if (pruneOnly) {
    console.log(`Pruned ${result.pruned} non-Edo units`);
  } else {
    const loaded = result.stateTotal - result.stateRemaining;
    console.log(
      `${result.state} ${loaded}/${result.stateTotal} (+${result.inserted} new, ${result.updated} updated, ${result.failed} failed)`
    );
  }
  if (result.done) break;
  if (result.stateRemaining > 0) {
    offset = result.nextOffset;
    pruneOnly = false;
    continue;
  }
  pruneOnly = true;
  offset = 0;
}

console.log(`Done. inserted=${inserted} updated=${updated} pruned=${pruned} failed=${failed}`);
if (failed) process.exit(1);
