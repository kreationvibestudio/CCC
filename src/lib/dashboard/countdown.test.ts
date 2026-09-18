import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefingGreeting, daysUntil } from "./countdown.ts";

describe("daysUntil", () => {
  it("returns null when no date is set", () => {
    assert.equal(daysUntil(null), null);
    assert.equal(daysUntil(undefined), null);
  });

  it("returns whole days remaining", () => {
    const now = Date.parse("2026-09-18T12:00:00.000Z");
    assert.equal(daysUntil("2026-09-28T12:00:00.000Z", now), 10);
  });

  it("returns 0 for past dates", () => {
    const now = Date.parse("2026-09-18T12:00:00.000Z");
    assert.equal(daysUntil("2026-09-01T12:00:00.000Z", now), 0);
  });
});

describe("briefingGreeting", () => {
  it("picks morning, afternoon, and evening", () => {
    assert.equal(briefingGreeting(new Date("2026-09-18T08:00:00")), "Good morning");
    assert.equal(briefingGreeting(new Date("2026-09-18T14:00:00")), "Good afternoon");
    assert.equal(briefingGreeting(new Date("2026-09-18T20:00:00")), "Good evening");
  });
});
