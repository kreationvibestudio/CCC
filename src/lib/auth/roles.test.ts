import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateRecords,
  canDeleteRecords,
  denyCreateIfRestricted,
  denyDeleteIfRestricted,
  hasPermission,
  homePathForRole,
  isFieldAgentRole,
} from "../../types/auth.ts";

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

describe("Director General oversight", () => {
  it("has the same HQ permissions as Super Administrator", () => {
    for (const permission of [
      "dashboard.view",
      "admin.users",
      "admin.audit",
      "polling_units.manage",
      "volunteers.manage",
      "crm.manage",
      "events.manage",
      "situation_room.manage",
      "communications.send",
      "social.manage",
    ] as const) {
      assert.equal(hasPermission("director_general", permission), true, permission);
      assert.equal(
        hasPermission("director_general", permission),
        hasPermission("super_administrator", permission),
        permission
      );
    }
  });

  it("cannot add or delete records", () => {
    assert.equal(canCreateRecords("director_general"), false);
    assert.equal(canDeleteRecords("director_general"), false);
    assert.match(denyCreateIfRestricted("director_general") ?? "", /cannot add or delete/);
    assert.match(denyDeleteIfRestricted("director_general") ?? "", /cannot add or delete/);
  });

  it("leaves Super Administrator free to add and delete", () => {
    assert.equal(canCreateRecords("super_administrator"), true);
    assert.equal(canDeleteRecords("super_administrator"), true);
    assert.equal(denyCreateIfRestricted("super_administrator"), null);
    assert.equal(denyDeleteIfRestricted("super_administrator"), null);
  });
});
