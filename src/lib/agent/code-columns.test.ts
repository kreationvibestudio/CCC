import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { omitUnmigratedAgentCodeColumns } from "./code-columns.ts";

const payload = {
  tenant_id: "t",
  profile_id: "p",
  polling_unit_id: "u",
  code_hash: "h",
  code_hint: "HINT",
  code_display: "v1:x",
  expires_at: "2026-12-01T00:00:00.000Z",
};

describe("omitUnmigratedAgentCodeColumns", () => {
  it("retries without expires_at when that column is missing", () => {
    const next = omitUnmigratedAgentCodeColumns(
      payload,
      "Could not find the 'expires_at' column of 'agent_access_codes' in the schema cache"
    );
    assert.ok(next);
    assert.equal("expires_at" in next, false);
    assert.equal(next.code_display, payload.code_display);
  });

  it("retries without code_display when that column is missing", () => {
    const next = omitUnmigratedAgentCodeColumns(
      payload,
      "Could not find the 'code_display' column of 'agent_access_codes' in the schema cache"
    );
    assert.ok(next);
    assert.equal("code_display" in next, false);
    assert.equal(next.expires_at, payload.expires_at);
  });

  it("does not strip columns for a missing table", () => {
    assert.equal(
      omitUnmigratedAgentCodeColumns(
        payload,
        "Could not find the table 'public.agent_access_codes' in the schema cache"
      ),
      null
    );
  });
});
