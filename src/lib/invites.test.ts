import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingColumnError, isMissingRelationError } from "./public-error.ts";

describe("isMissingRelationError", () => {
  it("detects PostgREST schema-cache misses for tenant_invites", () => {
    assert.equal(
      isMissingRelationError(
        "Could not find the table 'public.tenant_invites' in the schema cache",
        "tenant_invites",
      ),
      true,
    );
  });

  it("detects a missing agent_access_codes table", () => {
    assert.equal(
      isMissingRelationError(
        "Could not find the table 'public.agent_access_codes' in the schema cache",
        "agent_access_codes",
      ),
      true,
    );
  });

  it("does not treat a missing expires_at column as a missing table", () => {
    // Production HQ already issued codes; only 20260905020000_agent_code_expiry.sql is pending.
    const missingExpiresAt =
      "Could not find the 'expires_at' column of 'agent_access_codes' in the schema cache";
    assert.equal(isMissingRelationError(missingExpiresAt, "agent_access_codes"), false);
    assert.equal(isMissingColumnError(missingExpiresAt, "expires_at"), true);
  });

  it("ignores other tables and unrelated failures", () => {
    assert.equal(
      isMissingRelationError(
        "Could not find the table 'public.tenant_invites' in the schema cache",
        "profiles",
      ),
      false,
    );
    assert.equal(isMissingRelationError("duplicate key value violates unique constraint", "tenant_invites"), false);
    assert.equal(isMissingRelationError(undefined, "tenant_invites"), false);
  });
});
