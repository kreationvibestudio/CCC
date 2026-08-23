import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGeocodeQueries,
  extractStreetHints,
  expandStateForGeocode,
  isInNigeria,
  pickBestHit,
  scoreGeocodeHit,
  type PollingUnitGeocodeInput,
} from "./geocode.ts";

const hilton: PollingUnitGeocodeInput = {
  name: "MAITAMA 3/RD. JUNCTION GANA / USMAN NICON HILTON",
  ward: "Wuse",
  lga: "Municipal",
  state: "FCT",
};

describe("polling unit geocode queries", () => {
  it("uses the unit's own state, not a hardcoded Edo", () => {
    const queries = buildGeocodeQueries(hilton);
    assert.ok(queries.length > 0);
    assert.ok(queries.every((q) => !/\bedo\b/i.test(q)));
    assert.ok(queries.some((q) => /abuja|federal capital/i.test(q)));
    assert.ok(queries.some((q) => /gana/i.test(q)));
    assert.ok(queries.some((q) => /maitama/i.test(q)));
    assert.ok(queries.every((q) => /nigeria/i.test(q)));
  });

  it("pulls Gana Street/Junction out of INEC slash names", () => {
    const streets = extractStreetHints(hilton.name);
    assert.ok(streets.some((s) => /gana/i.test(s)));
  });

  it("expands FCT and Lagos abbreviations", () => {
    assert.match(expandStateForGeocode("FCT"), /Abuja/);
    assert.match(expandStateForGeocode("LAGOS"), /Lagos/);
    assert.equal(expandStateForGeocode("Edo"), "Edo");
  });

  it("rejects coordinates outside Nigeria", () => {
    assert.equal(isInNigeria(43.469, -80.575), false);
    assert.equal(isInNigeria(9.0814, 7.5004), true);
  });

  it("prefers Gana Street in Maitama over the Nicon hotel in Garki", () => {
    const gana = {
      lat: 9.0814181,
      lng: 7.5004127,
      label: "Gana Street, Maitama, Abuja, Municipal Area Council, Federal Capital Territory, Nigeria",
    };
    const hotel = {
      lat: 9.0451518,
      lng: 7.4938628,
      label: "Nicon Luxury, Emeka Anaoku Street, Garki District, Abuja, Municipal Area Council, Federal Capital Territory, Nigeria",
    };
    assert.ok(scoreGeocodeHit(hilton, gana) > scoreGeocodeHit(hilton, hotel));
    const picked = pickBestHit(hilton, [hotel, gana], "nominatim", "test");
    assert.ok(picked);
    assert.equal(picked.lat, gana.lat);
    assert.equal(picked.lng, gana.lng);
  });

  it("still accepts a ward/LGA pin when no street hits", () => {
    const ward = {
      lat: 9.07,
      lng: 7.48,
      label: "Wuse, Abuja, Municipal Area Council, Federal Capital Territory, Nigeria",
    };
    const picked = pickBestHit(hilton, [ward], "photon", "ward");
    assert.ok(picked);
    assert.ok(picked.score >= 5);
  });
});
