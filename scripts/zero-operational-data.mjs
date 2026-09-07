#!/usr/bin/env node
/**
 * Zero all campaign operational/sample data. Keeps polling units + Edo geography + tenant.
 *
 *   node scripts/zero-operational-data.mjs
 *   node scripts/zero-operational-data.mjs --audit
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const TENANT = "a0000000-0000-0000-0000-000000000001";
const auditOnly = process.argv.includes("--audit");

const OPERATIONAL_TABLES = [
  "comment_notes",
  "comment_responses",
  "comments",
  "social_posts",
  "social_accounts",
  "ai_analyses",
  "ai_briefings",
  "ai_suggestions",
  "volunteer_tasks",
  "volunteer_attendance",
  "volunteer_checkins",
  "volunteers",
  "contact_interactions",
  "donations",
  "contacts",
  "event_photos",
  "event_checkins",
  "event_attendees",
  "campaign_events",
  "incident_media",
  "incident_reports",
  "election_results",
  "agent_report_media",
  "agent_reports",
  "polling_unit_status",
  "messages",
  "message_campaigns",
  "message_templates",
  "notifications",
  "activities",
  "audit_logs",
  "tenant_settings",
  "campaign_locations",
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function countRows(admin, table, filterTenant = true) {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  if (filterTenant) q = q.eq("tenant_id", TENANT);
  const { count, error } = await q;
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

async function deleteAll(admin, table) {
  const { error } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error && /does not exist|schema cache/i.test(error.message)) return { skipped: true };
  if (error) return { error: error.message };
  return { error: null };
}

async function audit(admin) {
  const report = {};
  for (const table of OPERATIONAL_TABLES) {
    const tenanted = ![
      "comment_notes",
      "comment_responses",
      "volunteer_attendance",
      "volunteer_checkins",
      "contact_interactions",
      "event_photos",
      "event_checkins",
      "event_attendees",
      "incident_media",
    ].includes(table);
    report[table] = await countRows(admin, table, tenanted);
  }
  report.polling_units = await countRows(admin, "polling_units", true);
  report.profiles = await countRows(admin, "profiles", true);
  report.tenants = await countRows(admin, "tenants", false);
  return report;
}

function printAudit(report) {
  console.log("\nRow counts:");
  for (const [table, result] of Object.entries(report)) {
    if (result.error) {
      console.log(`  ${table}: error (${result.error})`);
    } else {
      console.log(`  ${table}: ${result.count}`);
    }
  }
}

async function emptyStorage(admin) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error || !buckets?.some((b) => b.name === "election-media")) {
    return;
  }
  const { data: files } = await admin.storage.from("election-media").list("", { limit: 1000 });
  if (!files?.length) return;
  const paths = files.map((f) => f.name);
  if (paths.length) await admin.storage.from("election-media").remove(paths);
  ok(`Cleared ${paths.length} object(s) from election-media`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local or secrets/latest.env.local)");
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    fail("Refusing to run against local Supabase — this targets the campaign cloud project");
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL (often leftover [SENSITIVE] from vercel env pull)");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\nZero operational data — ${new URL(url).hostname}\n`);

  const before = await audit(admin);
  printAudit(before);
  const puBefore = before.polling_units.count ?? 0;

  if (auditOnly) return;

  if (puBefore === 0) {
    console.log("\n⚠ No polling units found. Continuing wipe of operational tables anyway.");
  }

  const rpc = await admin.rpc("zero_operational_campaign_data", { p_tenant_id: TENANT });
  if (!rpc.error) {
    ok(`Truncated operational tables via SQL (${rpc.data?.polling_units ?? "?"} polling units kept)`);
  } else {
    console.log(`  RPC unavailable (${rpc.error.message}). Falling back to per-table deletes.`);
    for (const table of OPERATIONAL_TABLES) {
      const result = await deleteAll(admin, table);
      if (result.skipped) {
        console.log(`  skip ${table} (not in schema)`);
        continue;
      }
      if (result.error) fail(`Delete ${table}: ${result.error}`);
      ok(`Cleared ${table}`);
    }

    const { error: tenantError } = await admin
      .from("tenants")
      .update({
        name: "Campaign",
        slug: "campaign",
        logo_url: null,
        election_date: null,
        campaign_end_date: null,
        fundraising_goal: 0,
      })
      .eq("id", TENANT);
    if (tenantError) fail(`Reset tenant: ${tenantError.message}`);
    ok("Reset tenant name/dates/fundraising to empty");
  }

  await emptyStorage(admin);

  const after = await audit(admin);
  printAudit(after);

  const puAfter = after.polling_units.count ?? 0;
  if (puAfter !== puBefore) {
    fail(`Polling unit count changed (${puBefore} → ${puAfter}). Aborting as failed.`);
  }

  const leftover = OPERATIONAL_TABLES.filter((t) => (after[t].count ?? 0) > 0);
  if (leftover.length) {
    fail(`Still has rows: ${leftover.join(", ")}`);
  }

  console.log(`\n✓ System zeroed. Polling units kept: ${puAfter}`);
  console.log("  User accounts were left in place.");
}

main().catch((e) => fail(e.message));
