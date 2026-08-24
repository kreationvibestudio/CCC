import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCampaignPollingUnit, isCampaignState } from "./scope.ts";

describe("Edo campaign PU scope", () => {
  it("accepts Edo names, codes, and INEC state 12", () => {
    assert.equal(isCampaignState("EDO"), true);
    assert.equal(isCampaignState("Edo"), true);
    assert.equal(isCampaignState("12"), true);
    assert.equal(isCampaignPollingUnit({ state: "Edo", state_code: null }), true);
    assert.equal(isCampaignPollingUnit({ code: "EDO/ESAN-WEST/01/001" }), true);
    assert.equal(isCampaignPollingUnit({ code: "12/03/01/001" }), true);
  });

  it("rejects other states so national codes cannot crowd Edo search", () => {
    assert.equal(isCampaignState("FCT"), false);
    assert.equal(isCampaignState("37"), false);
    assert.equal(isCampaignPollingUnit({ state: "LAGOS", code: "LAGOS/IKEJA/01/001" }), false);
    assert.equal(isCampaignPollingUnit({ code: "FCT/AMAC/04/028" }), false);
  });
});
