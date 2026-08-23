import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_LOGIN_RADIUS_M, haversineMeters, isWithinAgentLoginRadius } from "./geo.ts";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    assert.ok(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792) < 1);
  });

  it("measures a known short hop in Lagos", () => {
    const meters = haversineMeters(6.5244, 3.3792, 6.5254, 3.3792);
    assert.ok(meters > 90 && meters < 130);
  });
});

describe("isWithinAgentLoginRadius", () => {
  it("allows on-site GPS and rejects a different ward", () => {
    assert.equal(isWithinAgentLoginRadius(40), true);
    assert.equal(isWithinAgentLoginRadius(AGENT_LOGIN_RADIUS_M), true);
    assert.equal(isWithinAgentLoginRadius(AGENT_LOGIN_RADIUS_M + 1), false);
    assert.equal(isWithinAgentLoginRadius(8000), false);
  });
});
