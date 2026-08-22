import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDistance, formatLagos } from "./lagos.ts";

describe("formatLagos", () => {
  it("formats a known UTC instant in Africa/Lagos", () => {
    const text = formatLagos("2026-08-22T12:00:00.000Z");
    assert.match(text, /22 Aug 2026/);
    assert.match(text, /1:00:00 pm/i);
  });
  it("returns an em dash for empty or invalid values", () => {
    assert.equal(formatLagos(null), "—");
    assert.equal(formatLagos(""), "—");
    assert.equal(formatLagos("not-a-date"), "—");
  });
});

describe("formatDistance", () => {
  it("uses metres under 1 km and kilometres above", () => {
    assert.equal(formatDistance(240), "240 m away");
    assert.equal(formatDistance(2400), "2.4 km away");
    assert.equal(formatDistance(null), null);
  });
});
