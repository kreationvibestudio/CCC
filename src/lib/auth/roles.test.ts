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
