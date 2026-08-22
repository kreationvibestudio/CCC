import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATUS_OPTIONS } from "./theme.ts";

describe("STATUS_OPTIONS", () => {
  it("includes voting finished between in-progress and delayed", () => {
    const values = STATUS_OPTIONS.map((option) => option.value);
    assert.equal(values.includes("voting_finished"), true);
    assert.equal(
      STATUS_OPTIONS.find((option) => option.value === "voting_finished")?.label,
      "Voting finished",
    );
    assert.ok(values.indexOf("voting_in_progress") < values.indexOf("voting_finished"));
    assert.ok(values.indexOf("voting_finished") < values.indexOf("delayed"));
  });
});
