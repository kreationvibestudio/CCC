import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCampaignPollingUnit, isCampaignState } from "./scope.ts";

describe("Edo campaign PU scope", () => {
  it("accepts Edo state names, EDO/ codes, and Edo LGAs", () => {
    assert.equal(isCampaignState("EDO"), true);
    assert.equal(isCampaignState("Edo"), true);
    assert.equal(isCampaignState("12"), true);
    assert.equal(isCampaignPollingUnit({ state: "Edo", state_code: null }), true);
    assert.equal(isCampaignPollingUnit({ code: "EDO/ESAN-WEST/01/001" }), true);
    assert.equal(isCampaignPollingUnit({ lga: "Esan West" }), true);
    assert.equal(isCampaignPollingUnit({ lga: "Ikpoba/Okha" }), true);
  });

  it("rejects other states and bare INEC 12/ codes without Edo geography", () => {
    assert.equal(isCampaignState("FCT"), false);
    assert.equal(isCampaignState("37"), false);
    assert.equal(isCampaignPollingUnit({ state: "LAGOS", code: "LAGOS/IKEJA/01/001" }), false);
    assert.equal(isCampaignPollingUnit({ code: "FCT/AMAC/04/028" }), false);
    // National dumps often misuse state 12 / 12/… prefixes — do not treat as Edo alone.
    assert.equal(isCampaignPollingUnit({ code: "12/03/01/001" }), false);
    assert.equal(isCampaignPollingUnit({ state_code: "12", state: "Lagos", code: "12/01/01/001" }), false);
    assert.equal(isCampaignPollingUnit({ lga: "Ikeja" }), false);
  });
});
