import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactTypeLabel,
  isInvalidContactTypeError,
  mergeInterests,
  resolvedContactType,
} from "./labels.ts";

describe("contactTypeLabel", () => {
  it("labels volunteers as Support and givers as Donor", () => {
    assert.equal(contactTypeLabel("supporter"), "Support");
    assert.equal(contactTypeLabel("individual", ["support"]), "Support");
    assert.equal(contactTypeLabel("donor"), "Donor");
    assert.equal(contactTypeLabel("donor", ["support"]), "Donor");
    assert.equal(contactTypeLabel("community_leader"), "community leader");
  });
});

describe("resolvedContactType", () => {
  it("keeps Donor when a donor later volunteers", () => {
    assert.equal(resolvedContactType("donor", "supporter"), "donor");
  });

  it("upgrades Support to Donor after a gift", () => {
    assert.equal(resolvedContactType("supporter", "donor"), "donor");
  });

  it("sets Support for a new volunteer", () => {
    assert.equal(resolvedContactType(null, "supporter"), "supporter");
  });
});

describe("mergeInterests", () => {
  it("adds the support tag without dropping existing interests", () => {
    assert.deepEqual(mergeInterests(["youth"], "supporter"), ["youth", "support"]);
    assert.deepEqual(mergeInterests(["support"], "supporter"), ["support"]);
    assert.deepEqual(mergeInterests(["youth"], "donor"), ["youth"]);
  });
});

describe("isInvalidContactTypeError", () => {
  it("detects a missing enum value so we can fall back", () => {
    assert.equal(
      isInvalidContactTypeError("invalid input value for enum contact_type: \"supporter\""),
      true
    );
    assert.equal(isInvalidContactTypeError("duplicate key"), false);
  });
});
