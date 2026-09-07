import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TABLE_RULES, isManagedTable, pickAllowedColumns } from "./table-rules.ts";

describe("isManagedTable", () => {
  it("accepts only the declared tables", () => {
    assert.equal(isManagedTable("polling_units"), true);
    assert.equal(isManagedTable("profiles"), false);
    assert.equal(isManagedTable("audit_logs"), false);
    assert.equal(isManagedTable("constructor"), false);
  });
});

describe("pickAllowedColumns", () => {
  it("keeps declared columns", () => {
    const result = pickAllowedColumns("polling_units", { name: "PU 001", ward: "Ward A" });
    assert.deepEqual(result.updates, { name: "PU 001", ward: "Ward A" });
    assert.deepEqual(result.rejected, []);
  });

  it("rejects identity and tenancy columns", () => {
    const result = pickAllowedColumns("polling_units", {
      name: "PU 001",
      tenant_id: "a0000000-0000-0000-0000-000000000002",
      id: "11111111-1111-1111-1111-111111111111",
      created_at: "2020-01-01",
    });
    assert.deepEqual(result.updates, { name: "PU 001" });
    assert.deepEqual(result.rejected.sort(), ["created_at", "id", "tenant_id"]);
  });

  it("rejects a role escalation smuggled into a contact update", () => {
    const result = pickAllowedColumns("contacts", { full_name: "A", role: "super_administrator" });
    assert.deepEqual(result.rejected, ["role"]);
  });

  it("drops undefined values so partial forms do not blank columns", () => {
    const result = pickAllowedColumns("volunteers", { full_name: "B", email: undefined, phone: null });
    assert.deepEqual(result.updates, { full_name: "B", phone: null });
    assert.deepEqual(result.rejected, []);
  });

  it("covers every column the polling unit editor submits", () => {
    // Mirrors the payload built by updatePollingUnit.
    const submitted = [
      "code", "name", "ward", "lga", "state", "state_code", "lg_code", "ward_code",
      "pu_code", "registered_voters", "latitude", "longitude", "address",
      "risk_level", "security_notes", "logistics", "assigned_agent_id", "geocode_status",
    ];
    const payload = Object.fromEntries(submitted.map((key) => [key, "x"]));
    const result = pickAllowedColumns("polling_units", payload);
    assert.deepEqual(result.rejected, [], "polling unit edits must not be blocked");
    assert.equal(Object.keys(result.updates).length, submitted.length);
  });

  it("never allows a tenant_id column on any managed table", () => {
    for (const table of Object.keys(TABLE_RULES) as (keyof typeof TABLE_RULES)[]) {
      const result = pickAllowedColumns(table, { tenant_id: "x" });
      assert.deepEqual(result.rejected, ["tenant_id"], table);
    }
  });
});
