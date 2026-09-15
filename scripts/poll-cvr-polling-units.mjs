#!/usr/bin/env node
/**
 * Poll INEC CVR (cvr.inecnigeria.org) for the live Edo polling-unit register.
 *
 * Usage:
 *   npm run pu:poll-cvr
 *   npm run pu:poll-cvr -- --sync
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const args = process.argv.slice(2);
const sync = args.includes("--sync");

const { pollCvrEdoRegister, writeCvrSnapshot, cvrCachePath } = await import(
  "../src/lib/polling-units/cvr-poller.ts"
);

const snapshot = await pollCvrEdoRegister({
  onProgress: (message) => console.log(message),
});
await writeCvrSnapshot(snapshot);
console.log(`Cached ${snapshot.units.length} units → ${cvrCachePath()} (${snapshot.fetchedAt})`);

if (!sync) process.exit(0);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to --sync");
  process.exit(1);
}

const { CAMPAIGN_STATE } = await import("../src/lib/polling-units/scope.ts");
const { syncInecRegisterBatch } = await import("../src/lib/polling-units/inec-sync.ts");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let offset = 0;
let pruneOnly = false;
let inserted = 0;
let updated = 0;
let pruned = 0;
for (;;) {
  const result = await syncInecRegisterBatch(supabase, tenantId, {
    state: CAMPAIGN_STATE,
    offset,
    limit: 2000,
    pruneOnly,
  });
  inserted += result.inserted;
  updated += result.updated;
  pruned += result.pruned;
  console.log(
    pruneOnly
      ? `Pruned ${result.pruned} non-Edo units`
      : `${result.source} ${result.stateTotal - result.stateRemaining}/${result.stateTotal}`
  );
  if (result.done) break;
  if (result.stateRemaining > 0) {
    offset = result.nextOffset;
    pruneOnly = false;
    continue;
  }
  pruneOnly = true;
  offset = 0;
}
console.log(`Done. inserted=${inserted} updated=${updated} pruned=${pruned}`);
