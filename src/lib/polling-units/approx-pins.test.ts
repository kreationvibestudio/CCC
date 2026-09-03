import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approxPinForPollingUnit } from "./approx-pins.ts";

describe("approxPinForPollingUnit", () => {
  it("returns finite coords near Edo LGA hubs", () => {
    const a = approxPinForPollingUnit({
      code: "12/01/01/001",
      name: "UGBOGBO, OZEDI",
      ward: "Igarra I",
      lga: "Akoko Edo",
    });
    assert.ok(Number.isFinite(a.latitude) && Number.isFinite(a.longitude));
    assert.ok(a.latitude > 6.5 && a.latitude < 8);
    assert.ok(a.longitude > 5.5 && a.longitude < 7);
  });

  it("is deterministic for the same unit", () => {
    const row = { code: "12/03/01/010", name: "Test", ward: "W1", lga: "Oredo" };
    assert.deepEqual(approxPinForPollingUnit(row), approxPinForPollingUnit(row));
  });
});
