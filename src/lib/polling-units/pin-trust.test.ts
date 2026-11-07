import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approxPinForPollingUnit } from "./approx-pins.ts";
import { clearInecGpsCatalogCache, type InecGpsRow } from "./inec-cvr-gps.ts";
import { agentPinTrustError, isTrustedAgentPin } from "./pin-trust.ts";

describe("isTrustedAgentPin", () => {
  const catalog = new Map<string, InecGpsRow>([
    [
      "12/01/01/001",
      {
        state_code: "12",
        lg_code: "01",
        ward_code: "01",
        pu_code: "001",
        code: "12/01/01/001",
        name: "UGBOGBO, OZEDI",
        ward: "IGARRA I",
        lga: "AKOKO EDO",
        latitude: 7.29809837,
        longitude: 6.1035172,
      },
    ],
  ]);

  it("trusts explicit INEC / manual sources", () => {
    assert.equal(
      isTrustedAgentPin(
        { code: "12/01/01/001", latitude: 1, longitude: 1, pin_source: "inec_cvr" },
        catalog
      ),
      true
    );
    assert.equal(
      isTrustedAgentPin(
        { code: "12/01/01/001", latitude: 6.3, longitude: 5.6, pin_source: "manual" },
        catalog
      ),
      true
    );
  });

  it("rejects approx and street geocode sources", () => {
    const approx = approxPinForPollingUnit({
      code: "12/01/01/001",
      name: "UGBOGBO, OZEDI",
      ward: "IGARRA I",
      lga: "AKOKO EDO",
    });
    assert.equal(isTrustedAgentPin({ code: "12/01/01/001", ...approx, pin_source: "approx" }, catalog), false);
    assert.equal(
      isTrustedAgentPin(
        { code: "12/01/01/001", latitude: 7.1, longitude: 6.1, pin_source: "street_geocode" },
        catalog
      ),
      false
    );
  });

  it("trusts legacy pins that still match the INEC catalog", () => {
    assert.equal(
      isTrustedAgentPin(
        { code: "12/01/01/001", latitude: 7.29809837, longitude: 6.1035172, pin_source: null },
        catalog
      ),
      true
    );
  });

  it("rejects legacy approx centroids without a pin_source", () => {
    const approx = approxPinForPollingUnit({
      code: "12/12/01/001",
      name: "Hall",
      ward: "OGBE",
      lga: "OREDO",
    });
    assert.equal(isTrustedAgentPin({ code: "12/12/01/001", ...approx, pin_source: null }, catalog), false);
    assert.match(agentPinTrustError({ code: "12/12/01/001", ...approx, pin_source: "approx" }), /approximate/i);
  });
});

describe("catalog cache helper", () => {
  it("clears without throwing", () => {
    clearInecGpsCatalogCache();
  });
});
