import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingRelationError } from "./invites.ts";

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
