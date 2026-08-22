import { parseBearer, safeInternalPath } from "./bearer.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("parseBearer", () => {
  it("reads a Bearer token", () => {
    assert.equal(parseBearer("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"), "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig");
  });
  it("rejects missing, short, or placeholder values", () => {
    assert.equal(parseBearer(null), null);
    assert.equal(parseBearer("Basic abc"), null);
    assert.equal(parseBearer("Bearer [SENSITIVE]"), null);
    assert.equal(parseBearer("Bearer short"), null);
  });
});

describe("safeInternalPath", () => {
  it("allows agent redirect", () => {
    assert.equal(safeInternalPath("/agent"), "/agent");
    assert.equal(safeInternalPath("/agent?x=1"), "/agent?x=1");
  });
  it("blocks open redirects", () => {
    assert.equal(safeInternalPath("https://evil.test"), null);
    assert.equal(safeInternalPath("//evil.test"), null);
    assert.equal(safeInternalPath("dashboard"), null);
    assert.equal(safeInternalPath("/\\evil"), null);
  });
});
