import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formDateTimeToIso, omitUnmigratedEventColumns } from "./event-columns.ts";

const payload = {
  tenant_id: "t",
  title: "Town hall",
  event_type: "town_hall",
  location: "Hall",
  starts_at: "2026-10-15T14:00:00.000Z",
  requires_trained: true,
  required_role_slug: null,
};

describe("omitUnmigratedEventColumns", () => {
  it("omits both LMS columns when required_role_slug is missing", () => {
    const next = omitUnmigratedEventColumns(
      payload,
      "Could not find the 'required_role_slug' column of 'campaign_events' in the schema cache"
    );
    assert.ok(next);
    assert.equal("requires_trained" in next, false);
    assert.equal("required_role_slug" in next, false);
    assert.equal(next.title, "Town hall");
  });

  it("omits both LMS columns when requires_trained is missing", () => {
    const next = omitUnmigratedEventColumns(
      payload,
      "Could not find the 'requires_trained' column of 'campaign_events' in the schema cache"
    );
    assert.ok(next);
    assert.equal("requires_trained" in next, false);
    assert.equal("required_role_slug" in next, false);
  });

  it("does not strip columns for unrelated errors", () => {
    assert.equal(
      omitUnmigratedEventColumns(payload, "new row violates row-level security policy"),
      null
    );
  });
});

describe("formDateTimeToIso", () => {
  it("converts datetime-local values to ISO", () => {
    const iso = formDateTimeToIso("2026-10-15T14:00");
    assert.ok(iso);
    assert.match(iso, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(Number.isNaN(new Date(iso).getTime()), false);
  });

  it("returns null for empty or invalid input", () => {
    assert.equal(formDateTimeToIso(""), null);
    assert.equal(formDateTimeToIso("not-a-date"), null);
  });
});
