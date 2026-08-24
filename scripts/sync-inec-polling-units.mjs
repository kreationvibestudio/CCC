#!/usr/bin/env node
/**
 * Load official INEC polling units (JayCodist scrape of INEC's directory).
 *
 * Usage:
 *   npm run pu:sync-inec
 *   npm run pu:sync-inec -- --state=FCT
 *   npm run pu:sync-inec -- --all
 *   npm run pu:sync-inec -- --state=LAGOS --limit=250
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const stateArg = args.find((a) => a.startsWith("--state="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const all = args.includes("--all") || !stateArg;
const limit = limitArg ? parseInt(limitArg, 10) : 400;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { INEC_STATE_FILES } = await import("../src/lib/polling-units/inec-register.ts");
const { syncInecRegisterBatch } = await import("../src/lib/polling-units/inec-sync.ts");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const startState = stateArg || INEC_STATE_FILES[0]?.token;
let state = startState;
let offset = 0;
let inserted = 0;
let updated = 0;
let failed = 0;

console.log(`Syncing INEC register into tenant ${tenantId} from ${url}`);

while (state) {
  const result = await syncInecRegisterBatch(supabase, tenantId, { state, offset, limit });
  inserted += result.inserted;
  updated += result.updated;
  failed += result.failed;
  const loaded = result.stateTotal - result.stateRemaining;
  console.log(
    `${result.state} ${loaded}/${result.stateTotal} (+${result.inserted} new, ${result.updated} updated, ${result.failed} failed)`
  );
  if (result.stateRemaining > 0) {
    offset = result.nextOffset;
    continue;
  }
  if (!all || !result.nextState || result.nextState === startState) break;
  if (stateArg && result.nextState !== stateArg) break;
  state = result.nextState;
  offset = 0;
}

console.log(`Done. inserted=${inserted} updated=${updated} failed=${failed}`);
if (failed) process.exit(1);
