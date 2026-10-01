import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOM_EVENT_TYPE_VALUE,
  isInvalidEventTypeEnumError,
  labelForEventType,
  normalizeEventType,
} from "./event-types.ts";

describe("normalizeEventType", () => {
  it("keeps preset values", () => {
    assert.equal(normalizeEventType("family_meeting"), "family_meeting");
    assert.equal(normalizeEventType("lga_meeting"), "lga_meeting");
    assert.equal(normalizeEventType("unit_meeting"), "unit_meeting");
    assert.equal(normalizeEventType("ward_meeting"), "ward_meeting");
  });

  it("maps labels and free text to slugs", () => {
    assert.equal(normalizeEventType("Family meeting"), "family_meeting");
    assert.equal(normalizeEventType("Youth Summit"), "youth_summit");
  });

  it("falls back for empty / custom sentinel", () => {
    assert.equal(normalizeEventType(""), "town_hall");
    assert.equal(normalizeEventType(CUSTOM_EVENT_TYPE_VALUE), "town_hall");
  });
});

describe("labelForEventType", () => {
  it("uses preset labels", () => {
    assert.equal(labelForEventType("unit_meeting"), "Unit meeting");
  });
});

describe("isInvalidEventTypeEnumError", () => {
  it("detects postgres enum rejection", () => {
    assert.equal(
      isInvalidEventTypeEnumError('invalid input value for enum event_type: "family_meeting"'),
      true
    );
  });
});
