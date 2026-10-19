import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, type UserRole } from "../../types/auth.ts";
import { WOMAN_LEADER_ROLE_KEYS, isWomanLeaderRoleError } from "./woman-leader-roles.ts";

describe("woman leader roles", () => {
  it("are labeled for Admin invite and have HQ view access", () => {
    assert.equal(ROLE_LABELS.ward_woman_leader, "Ward Woman Leader");
    assert.equal(ROLE_LABELS.unit_woman_leader, "Unit Woman Leader");
    assert.equal(ROLE_LABELS.lga_woman_leader, "LGA Woman Leader");
    assert.equal(ROLE_LABELS.senatorial_woman_leader, "Senatorial Woman Leader");

    for (const role of WOMAN_LEADER_ROLE_KEYS) {
      assert.ok(ROLE_PERMISSIONS[role as UserRole]?.includes("dashboard.view"), role);
      assert.equal(hasPermission(role, "training.view"), true, role);
      assert.equal(hasPermission(role, "admin.users"), false, role);
      assert.equal(hasPermission(role, "agent.portal"), false, role);
    }
  });

  it("detects missing enum migration errors", () => {
    assert.equal(
      isWomanLeaderRoleError('invalid input value for enum user_role: "ward_woman_leader"'),
      true
    );
    assert.equal(isWomanLeaderRoleError("Could not save the team profile"), false);
  });
});
