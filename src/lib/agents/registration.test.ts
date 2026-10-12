import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENTS_TABLE_MIGRATION_SQL } from "./identity-fields.ts";
import { parseAgentAssignmentCsv } from "./csv.ts";

describe("agents registration support", () => {
  it("exposes pasteable agents table SQL", () => {
    assert.match(AGENTS_TABLE_MIGRATION_SQL, /CREATE TABLE IF NOT EXISTS agents/);
    assert.match(AGENTS_TABLE_MIGRATION_SQL, /UNIQUE \(tenant_id, polling_unit_id\)/);
    assert.match(AGENTS_TABLE_MIGRATION_SQL, /tenant_isolation_agents/);
  });

  it("CSV rows carry fields needed for registration", () => {
    const rows = parseAgentAssignmentCsv(`full_name,membership_card_number,ward,pu_code,phone,voters_card_number,collation_role
Ada Agent,MC-9,Ward 3,12/03/009,08031112222,90F5B9,ward
`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.fullName, "Ada Agent");
    assert.equal(rows[0]?.membershipCardNumber, "MC-9");
    assert.equal(rows[0]?.ward, "Ward 3");
    assert.equal(rows[0]?.phone, "08031112222");
    assert.equal(rows[0]?.collationRole, "ward");
  });
});
