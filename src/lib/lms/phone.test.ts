import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { phoneLookupValues } from "./phone.ts";

describe("phoneLookupValues", () => {
  it("matches local 0-prefix numbers with +234 variants", () => {
    const values = phoneLookupValues("0803 111 0002");
    assert.ok(values.includes("08031110002"));
    assert.ok(values.includes("+2348031110002"));
  });

  it("matches international numbers back to local 0-prefix", () => {
    const values = phoneLookupValues("+2348031110002");
    assert.ok(values.includes("+2348031110002"));
    assert.ok(values.includes("08031110002"));
  });
});
