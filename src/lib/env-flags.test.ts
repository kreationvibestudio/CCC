import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEnvFlagEnabled } from "./env-flags.ts";

describe("isEnvFlagEnabled", () => {
  it("treats the usual truthy spellings as enabled", () => {
    for (const value of ["1", "true", "TRUE", " yes ", "on", "enabled"]) {
      assert.equal(isEnvFlagEnabled(value), true, value);
    }
  });

  it("treats the usual falsy spellings as disabled", () => {
    for (const value of ["0", "false", "no", "off", "disabled"]) {
      assert.equal(isEnvFlagEnabled(value), false, value);
    }
  });

  it("falls back when unset, blank, or unrecognised", () => {
    assert.equal(isEnvFlagEnabled(undefined), false);
    assert.equal(isEnvFlagEnabled(""), false);
    assert.equal(isEnvFlagEnabled("   "), false);
    assert.equal(isEnvFlagEnabled("maybe"), false);
    assert.equal(isEnvFlagEnabled("maybe", true), true);
    assert.equal(isEnvFlagEnabled(undefined, true), true);
  });
});
