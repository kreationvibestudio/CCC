import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugifyWorkspace } from "./tenancy.ts";

describe("workspace tenancy helpers", () => {
  it("slugifies workspace names for unique tenant slugs", () => {
    assert.equal(slugifyWorkspace("NDC Campaign HQ"), "ndc-campaign-hq");
    assert.equal(slugifyWorkspace("APC 2027!!!"), "apc-2027");
  });
});
