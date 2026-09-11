import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateRecords,
  canDeleteRecords,
  canWriteRecords,
  denyCreateIfRestricted,
  denyDeleteIfRestricted,
  denyWriteIfRestricted,
  hasPermission,
  homePathForRole,
  isFieldAgentRole,
  ROLE_PERMISSIONS,
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
    assert.equal(hasPermission("polling_agent", "training.view"), false);
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

describe("Director General oversight", () => {
  it("has the same HQ permissions as Super Administrator", () => {
    for (const permission of [
      "dashboard.view",
      "admin.users",
      "admin.audit",
      "polling_units.manage",
      "volunteers.manage",
      "training.view",
      "training.manage",
      "crm.manage",
      "donations.view",
      "donations.manage",
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

  it("is read-only and cannot add, change, or delete", () => {
    assert.equal(canWriteRecords("director_general"), false);
    assert.equal(canCreateRecords("director_general"), false);
    assert.equal(canDeleteRecords("director_general"), false);
    assert.match(denyWriteIfRestricted("director_general") ?? "", /read-only/);
    assert.match(denyCreateIfRestricted("director_general") ?? "", /cannot add, change, or delete/);
    assert.match(denyDeleteIfRestricted("director_general") ?? "", /cannot add, change, or delete/);
  });

  it("leaves Super Administrator free to write", () => {
    assert.equal(canWriteRecords("super_administrator"), true);
    assert.equal(canCreateRecords("super_administrator"), true);
    assert.equal(canDeleteRecords("super_administrator"), true);
    assert.equal(denyWriteIfRestricted("super_administrator"), null);
    assert.equal(denyCreateIfRestricted("super_administrator"), null);
    assert.equal(denyDeleteIfRestricted("super_administrator"), null);
  });
});

describe("Training Management access", () => {
  it("lets every HQ dashboard role open Training Management", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) {
      if (role === "polling_agent") {
        assert.equal(hasPermission(role, "training.view"), false, role);
        continue;
      }
      assert.equal(hasPermission(role, "training.view"), true, role);
    }
  });

  it("limits training edits to volunteer coordinators and campaign leads", () => {
    for (const role of [
      "super_administrator",
      "campaign_director",
      "director_general",
      "volunteer_coordinator",
    ] as const) {
      assert.equal(hasPermission(role, "training.manage"), true, role);
    }
    for (const role of ["media_director", "data_analyst", "ward_coordinator", "candidate"] as const) {
      assert.equal(hasPermission(role, "training.manage"), false, role);
    }
  });
});

describe("Donations financials access", () => {
  it("limits gift totals to Super Administrator and Director General", () => {
    for (const role of ["super_administrator", "director_general"] as const) {
      assert.equal(hasPermission(role, "donations.view"), true, role);
      assert.equal(hasPermission(role, "donations.manage"), true, role);
    }
  });

  it("keeps fundraising off other HQ roles", () => {
    for (const role of [
      "candidate",
      "campaign_director",
      "media_director",
      "volunteer_coordinator",
      "data_analyst",
      "call_center_agent",
      "supporter",
      "polling_agent",
    ] as const) {
      assert.equal(hasPermission(role, "donations.view"), false, role);
      assert.equal(hasPermission(role, "donations.manage"), false, role);
    }
  });
});
