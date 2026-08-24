import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPollingUnitCode,
  inecNumericCode,
  inecNumericCodeFromParts,
  isCanonicalPollingUnitCode,
  parsePollingUnitCode,
} from "./code.ts";

describe("polling unit codes", () => {
  it("formats FCT AMAC as FCT/AMAC/ward/pu", () => {
    assert.equal(
      formatPollingUnitCode({
        state: "FCT",
        lga: "Municipal",
        ward: "Wuse",
        ward_code: "04",
        lg_code: "06",
        pu_code: "028",
      }),
      "FCT/AMAC/04/028"
    );
    assert.equal(
      formatPollingUnitCode({
        state: "FCT",
        lga: "AMAC",
        ward_code: "01",
        pu_code: "001",
      }),
      "FCT/AMAC/01/001"
    );
  });

  it("rewrites numeric INEC and shorthand FC codes", () => {
    assert.equal(formatPollingUnitCode({ code: "37/06/04/028", lga: "Municipal", state: "FCT" }), "FCT/AMAC/04/028");
    assert.equal(formatPollingUnitCode({ code: "FC/06/04/028" }), "FCT/AMAC/04/028");
    assert.equal(formatPollingUnitCode({ code: "FC/AMAC/01/001" }), "FCT/AMAC/01/001");
  });

  it("converts campaign FCT codes to INEC delimitation 37/06/ward/pu", () => {
    assert.equal(
      inecNumericCode({
        state: "FCT",
        lga: "AMAC",
        ward_code: "04",
        pu_code: "028",
      }),
      "37/06/04/028"
    );
    assert.equal(inecNumericCodeFromParts(parsePollingUnitCode("FCT/AMAC/04/028")!), "37/06/04/028");
  });

  it("formats Edo from INEC parts plus LGA name", () => {
    assert.equal(
      formatPollingUnitCode({
        code: "12/01/01/001",
        state: "EDO",
        state_code: "12",
        lga: "Akoko Edo",
        lg_code: "01",
        ward_code: "01",
        pu_code: "001",
      }),
      "EDO/AKOKO-EDO/01/001"
    );
  });

  it("pads ward and PU and infers Wuse as AMAC ward 04", () => {
    assert.equal(
      formatPollingUnitCode({
        state: "FCT",
        lga: "AMAC",
        ward: "Wuse",
        pu_code: "28",
      }),
      "FCT/AMAC/04/028"
    );
  });

  it("parses mixed separators and marks canonical codes", () => {
    assert.deepEqual(parsePollingUnitCode("fct-amac-04-028"), {
      state: "FCT",
      lga: "AMAC",
      ward: "04",
      pu: "028",
    });
    assert.equal(isCanonicalPollingUnitCode("FCT/AMAC/01/001"), true);
    assert.equal(isCanonicalPollingUnitCode("37/06/01/001"), false);
    assert.equal(isCanonicalPollingUnitCode("028"), false);
  });
});
