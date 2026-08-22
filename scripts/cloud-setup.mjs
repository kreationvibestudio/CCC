#!/usr/bin/env node
/**
 * Idempotent Supabase Cloud setup (automates supabase/CLOUD-SETUP.md).
 *
 * Required in .env.local (cloud project):
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * For SQL migrations + seed (pick one):
 *   SUPABASE_DB_PASSWORD — Database password from Supabase Dashboard → Database
 *   SUPABASE_ACCESS_TOKEN — Personal access token (https://supabase.com/dashboard/account/tokens)
 *
 * Usage:
 *   node scripts/cloud-setup.mjs          # audit + apply missing steps
 *   node scripts/cloud-setup.mjs --audit  # audit only
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { loadEnvLocal } from "./load-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_CLI = "supabase@2.111.0";
const CAMPAIGN_TENANT = "a0000000-0000-0000-0000-000000000001";
const BUCKET = "election-media";

const MIGRATIONS = [
  "supabase/migrations/20250101000000_initial_schema.sql",
  "supabase/migrations/20250201000000_polling_units_geocode.sql",
  "supabase/migrations/20250202000000_polling_units_inec_fields.sql",
  "supabase/migrations/20260820000000_rls_operational_tables.sql",
  "supabase/migrations/20260820000001_zero_operational_fn.sql",
  "supabase/migrations/20260820000002_donations_paystack.sql",
  "supabase/migrations/20260820000003_self_serve_signup.sql",
  "supabase/migrations/20260820000004_nearest_polling_units.sql",
  "supabase/migrations/20260820000005_agent_reports_rls_and_race.sql",
  "supabase/migrations/20260820000006_list_pages_scale.sql",
  "supabase/migrations/20260820000007_polling_agent_assignment.sql",
  "supabase/migrations/20260822000001_pu_status_voting_finished.sql",
];

loadEnvLocal();

const auditOnly = process.argv.includes("--audit");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function info(msg) {
  console.log(`  ${msg}`);
}

function projectRefFromUrl(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  const ref = host.split(".")[0];
  if (!ref || ref === "127") return null;
  return ref;
}

function dbUrl(ref, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

function runSqlFile(file, ref, password) {
  const path = join(ROOT, file);
  if (!existsSync(path)) fail(`Missing SQL file: ${file}`);
  info(`Running ${file}…`);
  const result = spawnSync(
    "npx",
    ["--yes", SUPABASE_CLI, "db", "execute", "--db-url", dbUrl(ref, password), "-f", path],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "unknown error").trim();
    fail(`SQL failed (${file}): ${err.slice(0, 500)}`);
  }
}

async function managementRequest(ref, method, path, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function runSqlViaManagement(ref, query) {
  await managementRequest(ref, "POST", "/database/query", { query });
}

async function disableEmailConfirmation(ref) {
  await managementRequest(ref, "PATCH", "/config/auth", {
    mailer_autoconfirm: true,
    disable_signup: false,
  });
}

async function audit(admin) {
  const state = {
    schema: false,
    seed: false,
    puMigrations: false,
    adminUser: false,
    adminProfile: false,
    pollingUnitCount: 0,
    storageBucket: false,
    emailAutoconfirm: null,
  };

  const tenants = await admin.from("tenants").select("id").limit(1);
  if (!tenants.error && tenants.data?.length) {
    state.schema = true;
    const campaign = await admin.from("tenants").select("id").eq("id", CAMPAIGN_TENANT).maybeSingle();
    state.seed = !campaign.error && campaign.data != null;
  }

  if (state.schema) {
    const puCols = await admin.from("polling_units").select("pu_code").limit(1);
    state.puMigrations = !puCols.error;

    const count = await admin.from("polling_units").select("id", { count: "exact", head: true });
    state.pollingUnitCount = count.count ?? 0;
  }

  const users = await admin.auth.admin.listUsers({ perPage: 200 });
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminUser = adminEmail
    ? users.data?.users?.find((u) => u.email === adminEmail)
    : users.data?.users?.find((u) => u.email);
  state.adminUser = !!adminUser;

  if (adminUser) {
    const profile = await admin.from("profiles").select("role").eq("id", adminUser.id).maybeSingle();
    state.adminProfile = !profile.error && profile.data?.role === "super_administrator";
  }

  const buckets = await admin.storage.listBuckets();
  state.storageBucket = !buckets.error && buckets.data?.some((b) => b.name === BUCKET);

  if (accessToken) {
    try {
      const authConfig = await managementRequest(
        projectRefFromUrl(url),
        "GET",
        "/config/auth"
      );
      state.emailAutoconfirm = authConfig?.mailer_autoconfirm ?? null;
    } catch {
      state.emailAutoconfirm = null;
    }
  }

  return state;
}

async function ensureAdmin(admin) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    info("No ADMIN_EMAIL / ADMIN_PASSWORD set — skip creating an admin. First register becomes super administrator.");
    return;
  }

  let userId;
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed.data?.users?.find((u) => u.email === adminEmail);
  if (existing) {
    userId = existing.id;
    ok(`Admin user exists (${adminEmail})`);
  } else {
    const created = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (created.error) fail(`Create admin user: ${created.error.message}`);
    userId = created.data.user.id;
    ok(`Created admin user (${adminEmail})`);
  }

  const profile = await admin.from("profiles").upsert(
    {
      id: userId,
      tenant_id: CAMPAIGN_TENANT,
      email: adminEmail,
      full_name: process.env.ADMIN_FULL_NAME?.trim() || "Campaign Admin",
      role: "super_administrator",
    },
    { onConflict: "id" }
  );
  if (profile.error) fail(`Admin profile: ${profile.error.message}`);
  ok("Admin profile is super_administrator");
}

async function ensureBucket(admin) {
  const listed = await admin.storage.listBuckets();
  if (listed.error) fail(`List buckets: ${listed.error.message}`);
  if (listed.data?.some((b) => b.name === BUCKET)) {
    ok(`Storage bucket '${BUCKET}' exists`);
    return;
  }
  const created = await admin.storage.createBucket(BUCKET, { public: true });
  if (created.error) fail(`Create bucket: ${created.error.message}`);
  ok(`Created storage bucket '${BUCKET}' (public)`);
}

async function importPollingUnitsIfNeeded(admin, beforeCount) {
  if (beforeCount > 10) {
    ok(`Polling units already imported (${beforeCount} rows)`);
    return;
  }
  info("Importing Edo/Esan polling units…");
  const result = spawnSync("node", ["scripts/import-polling-units.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`PU import: ${(result.stderr || result.stdout || "").trim().slice(0, 400)}`);
  }
  ok("Polling units imported from CSV");
}

async function main() {
  if (!url || !serviceKey) {
    fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    fail("This script targets Supabase Cloud. For local dev use .cursor/dev-bootstrap.sh");
  }

  const ref = projectRefFromUrl(url);
  if (!ref) fail(`Could not parse project ref from ${url}`);

  console.log(`\nSupabase Cloud setup — project ${ref}\n`);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let state = await audit(admin);
  console.log("Audit:");
  info(`Schema: ${state.schema ? "yes" : "missing"}`);
  info(`Seed data: ${state.seed ? "yes" : "missing"}`);
  info(`PU migrations: ${state.puMigrations ? "yes" : "missing"}`);
  info(`Admin user: ${state.adminUser ? "yes" : "missing"}`);
  info(`Admin profile: ${state.adminProfile ? "yes" : "missing"}`);
  info(`Polling units: ${state.pollingUnitCount}`);
  info(`Storage bucket: ${state.storageBucket ? "yes" : "missing"}`);
  if (state.emailAutoconfirm != null) {
    info(`Email auto-confirm: ${state.emailAutoconfirm ? "on" : "off"}`);
  }

  if (auditOnly) return;

  const canRunSql = dbPassword || accessToken;
  if (!state.schema && !canRunSql) {
    fail("Schema missing — add SUPABASE_DB_PASSWORD or SUPABASE_ACCESS_TOKEN to run migrations");
  }

  if (!state.schema) {
    if (dbPassword) {
      for (const file of MIGRATIONS.slice(0, 1)) runSqlFile(file, ref, dbPassword);
    } else {
      await runSqlViaManagement(ref, readFileSync(join(ROOT, MIGRATIONS[0]), "utf8"));
    }
    ok("Initial schema applied");
    state.schema = true;
  }

  if (!state.seed && canRunSql) {
    if (dbPassword) {
      runSqlFile("supabase/seed.sql", ref, dbPassword);
    } else {
      await runSqlViaManagement(ref, readFileSync(join(ROOT, "supabase/seed.sql"), "utf8"));
    }
    ok("Seed data applied");
    state.seed = true;
  }

  if (!state.puMigrations && canRunSql) {
    for (const file of MIGRATIONS.slice(1, 3)) {
      if (dbPassword) runSqlFile(file, ref, dbPassword);
      else await runSqlViaManagement(ref, readFileSync(join(ROOT, file), "utf8"));
    }
    ok("Polling-unit migrations applied");
    state.puMigrations = true;
  }

  if (canRunSql) {
    const rlsFile = MIGRATIONS[3];
    if (dbPassword) runSqlFile(rlsFile, ref, dbPassword);
    else await runSqlViaManagement(ref, readFileSync(join(ROOT, rlsFile), "utf8"));
    ok("Operational RLS policies applied");
  }

  if (!state.seed) {
    fail("Seed data still missing — run seed.sql with database credentials");
  }

  await ensureAdmin(admin);

  if (accessToken && state.emailAutoconfirm === false) {
    await disableEmailConfirmation(ref);
    ok("Email confirmation disabled (mailer_autoconfirm)");
  } else if (state.emailAutoconfirm === false) {
    info("Manual: Dashboard → Authentication → Providers → Email → turn OFF Confirm email");
  }

  await ensureBucket(admin);
  await importPollingUnitsIfNeeded(admin, state.pollingUnitCount);

  state = await audit(admin);
  console.log("\nFinal state:");
  info(`Schema: ${state.schema ? "yes" : "missing"}`);
  info(`Seed: ${state.seed ? "yes" : "missing"}`);
  info(`PU migrations: ${state.puMigrations ? "yes" : "missing"}`);
  info(`Admin ready: ${state.adminUser && state.adminProfile ? "yes" : "no"}`);
  info(`Polling units: ${state.pollingUnitCount}`);
  info(`Storage bucket: ${state.storageBucket ? "yes" : "missing"}`);

  if (!state.schema || !state.seed || !state.puMigrations) {
    fail("Setup incomplete — review errors above");
  }

  console.log("\n✓ Supabase Cloud setup complete.");
  console.log("  Register the first account in the app — that user becomes super administrator.");
}

main().catch((e) => fail(e.message));
