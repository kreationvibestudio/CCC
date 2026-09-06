import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPermission, homePathForRole, isFieldAgentRole } from "../../types/auth.ts";

describe("Field Agent role", () => {
  it("is only polling_agent", () => {
    assert.equal(isFieldAgentRole("polling_agent"), true);
    assert.equal(isFieldAgentRole("super_administrator"), false);
    assert.equal(isFieldAgentRole("campaign_director"), false);
  });

  it("can use the Agent Portal and nothing else in HQ", () => {
    assert.equal(hasPermission("polling_agent", "agent.portal"), true);
    assert.equal(hasPermission("polling_agent", "dashboard.view"), false);
    assert.equal(hasPermission("polling_agent", "situation_room.view"), false);
    assert.equal(hasPermission("polling_agent", "maps.view"), false);
    assert.equal(hasPermission("polling_agent", "admin.users"), false);
  });

  it("lands on /agent instead of HQ", () => {
    assert.equal(homePathForRole("polling_agent"), "/agent");
    assert.equal(homePathForRole("super_administrator"), "/dashboard");
  });
});

describe("PU agent code issuance", () => {
  it("lets HQ campaign leads open PU Agents and issue codes", () => {
    for (const role of [
      "super_administrator",
      "candidate",
      "campaign_director",
      "director_general",
      "polling_unit_supervisor",
    ] as const) {
      assert.equal(hasPermission(role, "polling_units.manage"), true, role);
    }
  });

  it("keeps view-only HQ roles off the issue-codes action", () => {
    for (const role of ["ward_coordinator", "data_analyst"] as const) {
      assert.equal(hasPermission(role, "polling_units.manage"), false, role);
      assert.equal(hasPermission(role, "polling_units.view"), true, role);
    }
  });
});
