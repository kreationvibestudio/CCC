import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgentAssignmentCsv } from "./csv.ts";

describe("parseAgentAssignmentCsv", () => {
  it("accepts name and PU code without email", () => {
    const rows = parseAgentAssignmentCsv(`pu_code,full_name,phone
12/03/005,Jane Agent,08030000001
12/03/006,John Agent,
`);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.email, "");
    assert.equal(rows[0]?.fullName, "Jane Agent");
    assert.equal(rows[0]?.puCode, "12/03/005");
    assert.equal(rows[1]?.phone, "");
    assert.equal(rows[0]?.collationRole, "none");
  });

  it("still reads the older email-first sheet", () => {
    const rows = parseAgentAssignmentCsv(`pu_code,email,full_name,phone
12/03/005,jane.agent@example.com,Jane Agent,0803
`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.email, "jane.agent@example.com");
  });

  it("skips rows with a broken email and rows without a PU code", () => {
    const rows = parseAgentAssignmentCsv(`pu_code,email,full_name
,ok@example.com,No PU
12/03/007,not-an-email,Bad
12/03/008,,Named Agent
`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.puCode, "12/03/008");
    assert.equal(rows[0]?.fullName, "Named Agent");
  });

  it("reads membership, ward, PVC, and collation role", () => {
    const rows = parseAgentAssignmentCsv(`full_name,membership_card_number,ward,pu_code,phone,voters_card_number,collation_role
Jane Agent,MC-1,Ward 1,12/03/005,08030000001,90F5B1,ward
John Agent,MC-2,Ward 2,12/03/006,08030000002,90F5B2,lga
`);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.membershipCardNumber, "MC-1");
    assert.equal(rows[0]?.ward, "Ward 1");
    assert.equal(rows[0]?.votersCardNumber, "90F5B1");
    assert.equal(rows[0]?.collationRole, "ward");
    assert.equal(rows[1]?.collationRole, "lga");
  });
});
