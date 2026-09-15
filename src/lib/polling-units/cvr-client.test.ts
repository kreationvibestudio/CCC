import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCvrClient, parseCvrSearchPayload, parseLabeled, parseLocatorRedirect } from "./cvr-client.ts";
import { cvrNodeToRegisterUnit, flattenCvrOptionsToNode } from "./cvr-poller.ts";

describe("INEC CVR payload parsers", () => {
  it("parses labeled dropdown values", () => {
    assert.deepEqual(parseLabeled("01 - AKOKO EDO"), { code: "01", label: "AKOKO EDO" });
    assert.deepEqual(parseLabeled("001 - UGBOGBO, OZEDI"), { code: "001", label: "UGBOGBO, OZEDI" });
  });

  it("flattens PublicApi search maps and skips the placeholder", () => {
    const options = parseCvrSearchPayload([
      {
        "0": "--SELECT--",
        selected: "0",
        "225": "01 - AKOKO EDO",
        "226": "02 - EGOR",
      },
    ]);
    assert.equal(options.length, 2);
    assert.equal(options[0].id, "225");
    assert.equal(options[0].code, "01");
    assert.equal(options[0].label, "AKOKO EDO");
    assert.equal(options[1].id, "226");
  });

  it("reads lat/lng from the locator redirect callback", () => {
    const pin = parseLocatorRedirect("https://maps.google.com/?q=7.29809837,6.10351720");
    assert.ok(pin && "latitude" in pin);
    assert.ok(Math.abs(pin.latitude - 7.29809837) < 1e-8);
    assert.ok(Math.abs(pin.longitude - 6.1035172) < 1e-8);
  });
});

describe("INEC CVR register mapping", () => {
  it("maps Edo CVR ids to HQ display codes", () => {
    const node = flattenCvrOptionsToNode({
      lga: { id: "225", code: "01", label: "AKOKO EDO" },
      ward: { id: "900", code: "01", label: "IGARRA I" },
      pu: { id: "34059", code: "001", label: "UGBOGBO, OZEDI" },
    });
    assert.ok(node);
    assert.equal(node.delimitation, "12/01/01/001");
    assert.equal(node.displayCode, "EDO/AKOKO-EDO/01/001");
    const unit = cvrNodeToRegisterUnit(node);
    assert.equal(unit.stateToken, "EDO");
    assert.equal(unit.lgaToken, "AKOKO-EDO");
    assert.equal(unit.puCode, "001");
  });
});

describe("INEC CVR client", () => {
  it("warms the session then walks PublicApi and the locator redirect", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      const headers = new Headers();
      if (url.endsWith("/pu")) {
        headers.set("set-cookie", "CAKEPHP=session1; Path=/");
        return new Response("ok", { status: 200, headers });
      }
      if (url.includes("/PublicApi/lgas/")) {
        return Response.json([{ "0": "--SELECT--", selected: "0", "225": "01 - AKOKO EDO" }]);
      }
      if (url.includes("/pu_locator/index")) {
        headers.set("location", "https://maps.google.com/?q=7.1,6.2");
        return new Response(null, { status: 302, headers });
      }
      return new Response("nope", { status: 404 });
    };

    const client = await createCvrClient({ fetchImpl, delayMs: 0 });
    const lgas = await client.fetchOptions("lgas", "data[Search][state_id]", "12");
    assert.equal(lgas[0].label, "AKOKO EDO");
    const pin = await client.locate("225", "900", "34059");
    assert.equal(pin.latitude, 7.1);
    assert.equal(pin.longitude, 6.2);
    assert.ok(calls[0].includes("/pu"));
    assert.ok(calls.some((row) => row.includes("/PublicApi/lgas/")));
    assert.ok(calls.some((row) => row.startsWith("POST ") && row.includes("/pu_locator/index")));
  });

  it("polls LGAs → wards → PUs through a mock CVR client", async () => {
    const { pollCvrEdoRegister } = await import("./cvr-poller.ts");
    const snapshot = await pollCvrEdoRegister({
      client: {
        request: async () => new Response("ok"),
        fetchOptions: async (kind) => {
          if (kind === "lgas") return [{ id: "225", code: "01", label: "AKOKO EDO" }];
          if (kind === "wards") return [{ id: "900", code: "01", label: "IGARRA I" }];
          return [{ id: "34059", code: "001", label: "UGBOGBO, OZEDI" }];
        },
        locate: async () => ({ latitude: 7.1, longitude: 6.2, mapsUrl: "https://maps.google.com/?q=7.1,6.2" }),
      },
    });
    assert.equal(snapshot.units.length, 1);
    assert.equal(snapshot.units[0].delimitation, "12/01/01/001");
    assert.equal(snapshot.units[0].displayCode, "EDO/AKOKO-EDO/01/001");
    assert.equal(snapshot.source, "cvr");
  });
});
