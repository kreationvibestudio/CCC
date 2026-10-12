import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collationFlags,
  collationLabel,
  normalizeCollationRole,
} from "./identity-fields.ts";

describe("normalizeCollationRole", () => {
  it("reads explicit role strings", () => {
    assert.equal(normalizeCollationRole({ collationRole: "lga" }), "lga");
    assert.equal(normalizeCollationRole({ collationRole: "ward_collation" }), "ward");
    assert.equal(normalizeCollationRole({ collationRole: "" }), "none");
  });

  it("prefers a single boolean flag", () => {
    assert.equal(
      normalizeCollationRole({ isLgaCollationAgent: true, isWardCollationAgent: false }),
      "lga"
    );
    assert.equal(
      normalizeCollationRole({ isLgaCollationAgent: false, isWardCollationAgent: true }),
      "ward"
    );
    assert.equal(
      normalizeCollationRole({ isLgaCollationAgent: true, isWardCollationAgent: true }),
      "none"
    );
  });
});

describe("collationFlags / label", () => {
  it("maps roles to booleans and labels", () => {
    assert.deepEqual(collationFlags("lga"), {
      is_lga_collation_agent: true,
      is_ward_collation_agent: false,
    });
    assert.deepEqual(collationFlags("ward"), {
      is_lga_collation_agent: false,
      is_ward_collation_agent: true,
    });
    assert.equal(collationLabel("lga"), "LGA collation agent");
    assert.equal(collationLabel("none"), null);
  });
});
