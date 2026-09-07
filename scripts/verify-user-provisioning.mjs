#!/usr/bin/env node
/**
 * Regression probe for the provisioning paths handle_new_user must keep working
 * after signup hardening: HQ service-role creation (app_metadata) and the
 * tenant_invites ledger. Run against a local Supabase stack only.
 *
 *   node scripts/verify-user-provisioning.mjs
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
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "",
      ...(init.headers ?? {}),
    },
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

const created = [];
let failures = 0;

function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

const tenants = await rest("/rest/v1/tenants?select=id,name&order=created_at&limit=1", SERVICE);
const tenantId = tenants.body?.[0]?.id;
if (!tenantId) {
  console.error("No tenants in the database; seed first.");
  process.exit(2);
}

// 1. HQ invite path, as inviteUser() performs it: create the Auth login with the
// service role, then write the profile explicitly. GoTrue applies custom
// app_metadata in an UPDATE after the row is inserted, so an AFTER INSERT
// trigger cannot see it -- HQ provisioning must not depend on the trigger.
console.log("HQ invite (service-role createUser, then explicit profile upsert)");
{
  const email = `probe-hq-${Date.now()}@example.test`;
  const res = await rest("/auth/v1/admin/users", SERVICE, {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Hq!Passw0rd123",
      email_confirm: true,
      app_metadata: { tenant_id: tenantId, role: "campaign_director", hq_invite: true },
      user_metadata: { full_name: "HQ Probe" },
    }),
  });
  const userId = res.body?.id ?? null;
  console.log(`  createUser HTTP ${res.status}`);
  if (!userId) {
    failures += 1;
    console.log(`  FAIL  no user id returned: ${JSON.stringify(res.body).slice(0, 200)}`);
  } else {
    created.push(userId);
    const upsert = await rest("/rest/v1/profiles", SERVICE, {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: JSON.stringify({
        id: userId,
        tenant_id: tenantId,
        email,
        full_name: "HQ Probe",
        role: "campaign_director",
      }),
    });
    check("profile upsert accepted", upsert.status < 300, true);
    const profile = await rest(`/rest/v1/profiles?select=role,tenant_id&id=eq.${userId}`, SERVICE);
    const row = profile.body?.[0];
    check("role", row?.role, "campaign_director");
    check("tenant", row?.tenant_id, tenantId);
  }
}

// 2. The security invariant: user_metadata is attacker-controlled, so a signup
// carrying role + tenant_id in it must not receive a privileged profile.
console.log("\nAnon signup with role in user_metadata (must be ignored)");
{
  const email = `probe-meta-${Date.now()}@attacker.test`;
  const res = await rest("/auth/v1/signup", ANON, {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Attacker!Passw0rd",
      data: { full_name: "Meta Probe", role: "super_administrator", tenant_id: tenantId },
    }),
  });
  const userId = res.body?.user?.id ?? res.body?.id ?? null;
  console.log(`  signup HTTP ${res.status}`);
  if (userId) {
    created.push(userId);
    const profile = await rest(`/rest/v1/profiles?select=role&id=eq.${userId}`, SERVICE);
    check("privileged profile created", Boolean(profile.body?.[0]), false);
  } else {
    check("privileged profile created", false, false);
  }
}

// 3. Invite ledger path: anon signup carrying a valid invite token.
console.log("\nInvite ledger (anon signup with invite_token)");
{
  const email = `probe-invite-${Date.now()}@example.test`;
  const token = `probe-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const invite = await rest("/rest/v1/tenant_invites", SERVICE, {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      tenant_id: tenantId,
      email,
      role: "ward_coordinator",
      token,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  if (invite.status >= 300) {
    failures += 1;
    console.log(`  FAIL  could not create invite: ${JSON.stringify(invite.body).slice(0, 200)}`);
  } else {
    const res = await rest("/auth/v1/signup", ANON, {
      method: "POST",
      body: JSON.stringify({
        email,
        password: "Invited!Passw0rd",
        data: { full_name: "Invited Probe", invite_token: token, role: "super_administrator" },
      }),
    });
    const userId = res.body?.user?.id ?? res.body?.id ?? null;
    console.log(`  signup HTTP ${res.status}`);
    if (!userId) {
      failures += 1;
      console.log(`  FAIL  no user id returned: ${JSON.stringify(res.body).slice(0, 200)}`);
    } else {
      created.push(userId);
      const profile = await rest(`/rest/v1/profiles?select=role,tenant_id&id=eq.${userId}`, SERVICE);
      const row = profile.body?.[0];
      check("role from invite (not the requested super_administrator)", row?.role, "ward_coordinator");
      check("tenant", row?.tenant_id, tenantId);
      const used = await rest(
        `/rest/v1/tenant_invites?select=used_at&token=eq.${encodeURIComponent(token)}`,
        SERVICE
      );
      check("invite consumed", Boolean(used.body?.[0]?.used_at), true);
    }
    await rest(`/rest/v1/tenant_invites?token=eq.${encodeURIComponent(token)}`, SERVICE, { method: "DELETE" });
  }
}

for (const id of created) {
  await fetch(`${API}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
}

console.log(`\n${failures === 0 ? "RESULT: PASS" : `RESULT: FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
