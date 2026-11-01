import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCampaignStateFilter,
  isCampaignPollingUnit,
  isCampaignState,
  stateMatchOr,
} from "./scope.ts";

describe("nationwide scope helpers", () => {
  it("still recognizes Edo as the legacy default state token", () => {
    assert.equal(isCampaignState("EDO"), true);
    assert.equal(isCampaignState("Edo"), true);
    assert.equal(isCampaignState("12"), true);
    assert.equal(isCampaignState("FCT"), false);
  });

  it("treats any coded unit as valid (no Edo hard gate)", () => {
    assert.equal(isCampaignPollingUnit({ state: "Edo", state_code: null }), true);
    assert.equal(isCampaignPollingUnit({ code: "EDO/ESAN-WEST/01/001" }), true);
    assert.equal(isCampaignPollingUnit({ state: "LAGOS", code: "LAGOS/IKEJA/01/001" }), true);
    assert.equal(isCampaignPollingUnit({ code: "FCT/AMAC/04/028" }), true);
    assert.equal(isCampaignPollingUnit({ code: null, state: null }), false);
  });

  it("applyCampaignStateFilter is a no-op passthrough", () => {
    const q = { or: () => "mutated" };
    assert.equal(applyCampaignStateFilter(q), q);
  });

  it("builds a state match or-filter", () => {
    assert.match(stateMatchOr("Kano"), /state\.eq\.Kano/);
    assert.match(stateMatchOr("Kano"), /KANO/);
  });
});
