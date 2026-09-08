#!/usr/bin/env node
/**
 * Create a Field Agent login + access code for pinned polling units that have no agent.
 *
 *   node --experimental-strip-types scripts/issue-agent-codes.mjs --limit=25
 *
 * Does not invent map pins. Apply official INEC GPS first (`npm run pu:apply-gps`).
 */
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";
import {
  agentCodeExpiry,
  agentCodeHint,
  generateAgentCode,
  hashAgentCode,
} from "../src/lib/agent/access-code.ts";
import { omitUnmigratedAgentCodeColumns } from "../src/lib/agent/code-columns.ts";
import { encryptAgentCode } from "../src/lib/agent/code-vault.ts";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID ?? "a0000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : 25;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tempPassword() {
  return `${randomBytes(9).toString("base64url")}Aa1!`;
}

function syntheticEmail() {
  return `agent.${randomBytes(6).toString("hex")}@ccc.agent`;
}

function displayCode(pu) {
  const raw = String(pu.code || pu.pu_code || "").trim();
  return raw || pu.id;
}

const { data: units, error } = await admin
  .from("polling_units")
  .select("id, code, pu_code, name, ward, lga, latitude, longitude")
  .eq("tenant_id", tenantId)
  .is("assigned_agent_id", null)
  .not("latitude", "is", null)
  .not("longitude", "is", null)
  .order("code")
  .limit(limit);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const issued = [];
for (const pu of units ?? []) {
  const puLabel = displayCode(pu);
  const email = syntheticEmail();
  const fullName = `Agent ${puLabel}`;
  const created = await admin.auth.admin.createUser({
    email,
    password: tempPassword(),
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role: "polling_agent", hq_invite: true },
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user?.id) {
    console.error(`skip ${puLabel}: ${created.error?.message ?? "no user"}`);
    continue;
  }
  const userId = created.data.user.id;
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      tenant_id: tenantId,
      email,
      full_name: fullName,
      role: "polling_agent",
      ward: pu.ward,
      lga: pu.lga,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    console.error(`skip ${puLabel}: ${profileError.message}`);
    continue;
  }
  const { error: assignError } = await admin
    .from("polling_units")
    .update({ assigned_agent_id: userId })
    .eq("tenant_id", tenantId)
    .eq("id", pu.id);
  if (assignError) {
    console.error(`skip ${puLabel}: ${assignError.message}`);
    continue;
  }

  let code = "";
  let insertError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    code = generateAgentCode();
    let payload = {
      tenant_id: tenantId,
      profile_id: userId,
      polling_unit_id: pu.id,
      code_hash: hashAgentCode(code),
      code_hint: agentCodeHint(code),
      code_display: encryptAgentCode(code),
      expires_at: agentCodeExpiry().toISOString(),
    };
    insertError = null;
    for (let trim = 0; trim < 3; trim += 1) {
      const result = await admin.from("agent_access_codes").insert(payload);
      if (!result.error) {
        insertError = null;
        break;
      }
      insertError = result.error;
      const stripped = omitUnmigratedAgentCodeColumns(payload, result.error.message);
      if (!stripped) break;
      payload = stripped;
    }
    if (!insertError) break;
    if (!/duplicate|unique/i.test(insertError.message)) break;
  }
  if (insertError || !code) {
    console.error(`skip ${puLabel}: ${insertError?.message ?? "no code"}`);
    continue;
  }

  issued.push({
    name: fullName,
    code,
    puCode: puLabel,
    unitName: pu.name,
    latitude: Number(pu.latitude),
    longitude: Number(pu.longitude),
  });
  console.log(`${puLabel}  ${code}  ${pu.latitude},${pu.longitude}`);
}

console.log(`issued=${issued.length} limit=${limit}`);
if (issued.length) {
  writeFileSync("/tmp/issued-agent-codes.json", JSON.stringify(issued, null, 2));
}
