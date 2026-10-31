import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeWardValue, encodeWardValue } from "./geo-encode.ts";

describe("agent geo encode", () => {
  it("round-trips lga::ward values", () => {
    const value = encodeWardValue("Esan West", "Ward 1");
    assert.equal(value, "Esan West::Ward 1");
    assert.deepEqual(decodeWardValue(value), { lga: "Esan West", ward: "Ward 1" });
  });

  it("rejects malformed values", () => {
    assert.equal(decodeWardValue("Ward 1"), null);
    assert.equal(decodeWardValue("::Ward"), null);
  });
});
