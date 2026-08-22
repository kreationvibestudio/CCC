import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePollingUnitStatus, PU_STATUS_VALUES } from "./pu-status.ts";

describe("parsePollingUnitStatus", () => {
  it("accepts voting_finished and the other PU statuses", () => {
    assert.equal(parsePollingUnitStatus("voting_finished"), "voting_finished");
    assert.equal(parsePollingUnitStatus(" voting_in_progress "), "voting_in_progress");
    assert.deepEqual(
      [...PU_STATUS_VALUES],
      [
        "not_active",
        "voting_in_progress",
        "voting_finished",
        "delayed",
        "minor_issue",
        "serious_incident",
        "results_uploaded",
      ],
    );
  });

  it("rejects unknown values", () => {
    assert.equal(parsePollingUnitStatus(""), null);
    assert.equal(parsePollingUnitStatus("closed"), null);
    assert.equal(parsePollingUnitStatus("voting-finished"), null);
  });
});
