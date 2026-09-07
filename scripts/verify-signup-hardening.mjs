#!/usr/bin/env node
/**
 * Privilege-escalation probe for public signup.
 *
 * Signs up through GoTrue with nothing but the public anon key, asking for
 * super_administrator in a chosen workspace, and reports the role the database
 * actually assigned. Run against a local Supabase stack only.
 *
 *   node scripts/verify-signup-hardening.mjs
 */
const API = process.env.PROBE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.PROBE_ANON_KEY;
const SERVICE = process.env.PROBE_SERVICE_KEY;

if (!ANON || !SERVICE) {
  console.error("Set PROBE_ANON_KEY and PROBE_SERVICE_KEY");
  process.exit(2);
}

async function rest(path, key, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const tenants = await rest("/rest/v1/tenants?select=id,name&order=created_at&limit=1", SERVICE);
const tenantId = tenants.body?.[0]?.id;
if (!tenantId) {
  console.error("No tenants in the database; seed first.");
  process.exit(2);
}

const email = `probe-${Date.now()}@attacker.test`;
console.log(`target workspace : ${tenantId} (${tenants.body[0].name})`);
console.log(`probe identity   : ${email}`);
console.log(`credential used  : public anon key only\n`);

const signup = await rest("/auth/v1/signup", ANON, {
  method: "POST",
  body: JSON.stringify({
    email,
    password: "Attacker!Passw0rd",
    data: { full_name: "Probe Attacker", role: "super_administrator", tenant_id: tenantId },
  }),
});

console.log(`signup HTTP ${signup.status}`);
const userId = signup.body?.user?.id ?? signup.body?.id ?? null;
if (!userId) {
  console.log("signup rejected outright:", JSON.stringify(signup.body).slice(0, 300));
  console.log("\nRESULT: PASS (no account created)");
  process.exit(0);
}

const profile = await rest(
  `/rest/v1/profiles?select=id,role,tenant_id,email&id=eq.${userId}`,
  SERVICE
);
const row = profile.body?.[0] ?? null;

if (!row) {
  console.log("profile row      : none (account has no workspace access)");
  console.log("\nRESULT: PASS (requested super_administrator was ignored)");
} else {
  console.log(`profile role     : ${row.role}`);
  console.log(`profile tenant   : ${row.tenant_id}`);
  const escalated = row.role !== "supporter";
  const wrongTenant = row.tenant_id !== tenantId && row.role !== "supporter";
  if (escalated || wrongTenant) {
    console.log(`\nRESULT: FAIL - client-supplied role "${row.role}" was honoured`);
  } else {
    console.log("\nRESULT: PASS (downgraded to supporter, client role ignored)");
  }
}

// Clean up the probe account.
await fetch(`${API}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
