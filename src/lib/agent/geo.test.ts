import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_LOGIN_RADIUS_FT,
  AGENT_LOGIN_RADIUS_M,
  formatLoginDistance,
  haversineMeters,
  isWithinAgentLoginRadius,
  metersToFeet,
} from "./geo.ts";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    assert.ok(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792) < 1);
  });

  it("measures a known short hop in Lagos", () => {
    const meters = haversineMeters(6.5244, 3.3792, 6.5254, 3.3792);
    assert.ok(meters > 90 && meters < 130);
  });
});

describe("100-foot agent login fence", () => {
  it("is 100 feet", () => {
    assert.equal(AGENT_LOGIN_RADIUS_FT, 100);
    assert.ok(Math.abs(metersToFeet(AGENT_LOGIN_RADIUS_M) - 100) < 0.01);
  });

  it("allows a reading on the pin and at 100 ft, rejects 101 ft", () => {
    assert.equal(isWithinAgentLoginRadius(0), true);
    assert.equal(isWithinAgentLoginRadius(AGENT_LOGIN_RADIUS_M), true);
    assert.equal(isWithinAgentLoginRadius(AGENT_LOGIN_RADIUS_M + 0.4), false);
    assert.equal(isWithinAgentLoginRadius(40), false, "40 m is more than 100 ft");
    assert.equal(isWithinAgentLoginRadius(5000), false);
  });

  it("describes the miss in feet", () => {
    assert.equal(formatLoginDistance(0), "0 ft");
    assert.match(formatLoginDistance(30.48), /100 ft/);
  });
});
