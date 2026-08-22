import { jsonToFormData } from "./form-data.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("jsonToFormData", () => {
  it("stringifies objects and keeps scalars", () => {
    const fd = jsonToFormData({
      polling_unit_id: "abc",
      party_votes: { NDC: 12, APC: 4 },
      is_emergency: true,
      empty: "",
    });
    assert.equal(fd.get("polling_unit_id"), "abc");
    assert.equal(fd.get("party_votes"), JSON.stringify({ NDC: 12, APC: 4 }));
    assert.equal(fd.get("is_emergency"), "true");
    assert.equal(fd.get("empty"), null);
  });
});
