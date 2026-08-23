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
});
