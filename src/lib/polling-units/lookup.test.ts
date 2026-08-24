import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codeLookupVariants,
  pollingUnitSearchOrFilter,
  unitMatchesLookupQuery,
} from "./lookup.ts";

const hilton = {
  id: "1",
  code: "FCT/AMAC/04/028",
  pu_code: "028",
  name: "MAITAMA 3/RD. JUNCTION GANA / USMAN NICON HILTON",
  ward: "Wuse",
  lga: "Municipal",
  state: "FCT",
  state_code: "37",
  lg_code: "06",
  ward_code: "04",
};

describe("polling unit lookup", () => {
  it("expands display codes to INEC delimitation and padded serial", () => {
    const variants = codeLookupVariants("FCT/AMAC/04/028");
    assert.ok(variants.includes("FCT/AMAC/04/028"));
    assert.ok(variants.includes("37/06/04/028"));
    assert.ok(variants.includes("028"));
  });

  it("matches Hilton on display code, delimitation, and name", () => {
    assert.equal(unitMatchesLookupQuery(hilton, "FCT/AMAC/04/028"), true);
    assert.equal(unitMatchesLookupQuery(hilton, "37/06/04/028"), true);
    assert.equal(unitMatchesLookupQuery(hilton, "FC/AMAC/04/028"), true);
    assert.equal(unitMatchesLookupQuery(hilton, "HILTON"), true);
    assert.equal(unitMatchesLookupQuery(hilton, "LAGOS/IKEJA/01/001"), false);
  });

  it("builds a search filter that includes both code forms", () => {
    const filter = pollingUnitSearchOrFilter("FCT/AMAC/04/028");
    assert.match(filter, /FCT\/AMAC\/04\/028/);
    assert.match(filter, /37\/06\/04\/028/);
    assert.match(filter, /ward_code\.eq\.04/);
    assert.match(filter, /pu_code\.eq\.028/);
    assert.doesNotMatch(filter, /pu_code\.eq\."028"/);
    const loose = pollingUnitSearchOrFilter("HILTON");
    assert.match(loose, /name\.ilike/);
  });
});
