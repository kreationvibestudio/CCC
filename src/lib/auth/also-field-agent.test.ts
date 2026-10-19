import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessFieldAgentTools,
  permissionsForRole,
  resolveAlsoFieldAgent,
} from "./also-field-agent.ts";

describe("resolveAlsoFieldAgent", () => {
  it("only sticks on ward_coordinator", () => {
    assert.equal(resolveAlsoFieldAgent("ward_coordinator", true), true);
    assert.equal(resolveAlsoFieldAgent("ward_coordinator", false), false);
    assert.equal(resolveAlsoFieldAgent("polling_agent", true), false);
    assert.equal(resolveAlsoFieldAgent("super_administrator", true), false);
  });
});

describe("permissionsForRole", () => {
  it("adds agent.portal for dual ward coordinators without dropping HQ views", () => {
    const dual = permissionsForRole("ward_coordinator", { alsoFieldAgent: true });
    assert.ok(dual.includes("agent.portal"));
    assert.ok(dual.includes("dashboard.view"));
    assert.ok(dual.includes("polling_units.view"));

    const plain = permissionsForRole("ward_coordinator", { alsoFieldAgent: false });
    assert.equal(plain.includes("agent.portal"), false);
  });
});

describe("canAccessFieldAgentTools", () => {
  it("allows field agents and dual ward coordinators", () => {
    assert.equal(canAccessFieldAgentTools("polling_agent"), true);
    assert.equal(canAccessFieldAgentTools("ward_coordinator", true), true);
    assert.equal(canAccessFieldAgentTools("ward_coordinator", false), false);
    assert.equal(canAccessFieldAgentTools("campaign_director", true), false);
  });
});
