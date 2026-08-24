import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flattenInecStateJson, resolveInecState } from "./inec-register.ts";
import { matchInecUnit, type ExistingPollingUnit } from "./inec-sync.ts";

const fctFixture = {
  state: {
    code: "37",
    name: "FEDERAL CAPITAL TERRITORY",
    lgas: [
      {
        name: "MUNICIPAL",
        abbreviation: "06",
        wards: [
          {
            name: "WUSE",
            abbreviation: "04",
            pollingUnits: [
              {
                name: "MAITAMA 3/RD. JUNCTION GANA / USMAN NICON HILTON",
                abbreviation: "028",
                state: "37",
                lga: "06",
                ward: "04",
                units: "028",
                delimitation: "37/06/04/028",
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("INEC register flatten", () => {
  it("maps FCT MUNICIPAL PU 028 to FCT/AMAC/04/028 and 37/06/04/028", () => {
    const rows = flattenInecStateJson(fctFixture);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].displayCode, "FCT/AMAC/04/028");
    assert.equal(rows[0].delimitation, "37/06/04/028");
    assert.equal(rows[0].lgaToken, "AMAC");
    assert.equal(rows[0].puCode, "028");
    assert.equal(rows[0].wardName, "WUSE");
  });

  it("resolves FCT aliases to the official file", () => {
    assert.equal(resolveInecState("FCT")?.fileName, "federal-capital-territory.json");
    assert.equal(resolveInecState("Abuja")?.inecCode, "37");
    assert.equal(resolveInecState("37")?.token, "FCT");
  });
});

describe("INEC register matching", () => {
  it("matches an existing demo row by official name even when the stored code is a serial", () => {
    const [unit] = flattenInecStateJson(fctFixture);
    const existing: ExistingPollingUnit[] = [
      {
        id: "demo",
        code: "028",
        pu_code: "028",
        name: "MAITAMA 3/RD. JUNCTION GANA / USMAN NICON HILTON",
        ward: "Wuse",
        lga: "Municipal",
        state: "FCT",
        state_code: null,
        lg_code: null,
        ward_code: null,
        address: null,
        latitude: 9.08,
        longitude: 7.5,
        assigned_agent_id: null,
      },
    ];
    const match = matchInecUnit(unit, existing, new Set());
    assert.equal(match?.id, "demo");
  });
});
