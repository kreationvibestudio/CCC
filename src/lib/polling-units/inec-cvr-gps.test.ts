import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isApproxStoredPin, parseInecGpsCsv } from "./inec-cvr-gps.ts";
import { approxPinForPollingUnit } from "./approx-pins.ts";

describe("inec CVR GPS CSV", () => {
  it("parses quoted names and coordinates", () => {
    const csv = `state_code,lg_code,ward_code,pu_code,code,name,ward,lga,latitude,longitude,cvr_pu_id
12,01,01,001,12/01/01/001,"UGBOGBO, OZEDI",IGARRA I,AKOKO EDO,7.29809837,6.10351720,34059
`;
    const rows = parseInecGpsCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].code, "12/01/01/001");
    assert.equal(rows[0].name, "UGBOGBO, OZEDI");
    assert.ok(Math.abs(rows[0].latitude - 7.29809837) < 1e-8);
  });

  it("detects LGA-centroid approx pins", () => {
    const row = {
      code: "12/01/01/001",
      name: "UGBOGBO, OZEDI",
      ward: "Igarra I",
      lga: "Akoko Edo",
    };
    const approx = approxPinForPollingUnit(row);
    assert.equal(isApproxStoredPin({ ...row, ...approx }), true);
    assert.equal(
      isApproxStoredPin({ ...row, latitude: 7.29809837, longitude: 6.1035172 }),
      false
    );
  });
});
