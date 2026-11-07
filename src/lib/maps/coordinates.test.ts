import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCoordinateField,
  parseLatLngPaste,
  resolvePollingUnitCoordinates,
} from "./coordinates.ts";

describe("parseLatLngPaste", () => {
  it("reads a Google Maps pair", () => {
    assert.deepEqual(parseLatLngPaste("6.3346325, 5.6233922"), {
      latitude: 6.3346325,
      longitude: 5.6233922,
    });
  });

  it("reads a maps URL query", () => {
    const hit = parseLatLngPaste("https://maps.google.com/?q=6.3346325,5.6233922");
    assert.ok(hit);
    assert.equal(hit.latitude, 6.3346325);
    assert.equal(hit.longitude, 5.6233922);
  });

  it("reads an @lat,lng fragment", () => {
    const hit = parseLatLngPaste("https://www.google.com/maps/@6.33,5.62,17z");
    assert.ok(hit);
    assert.equal(hit.latitude, 6.33);
    assert.equal(hit.longitude, 5.62);
  });

  it("rejects junk", () => {
    assert.equal(parseLatLngPaste("Benin City"), null);
  });
});

describe("resolvePollingUnitCoordinates", () => {
  it("accepts separate fields", () => {
    const result = resolvePollingUnitCoordinates({ latitude: "6.33", longitude: "5.62" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.latitude, 6.33);
      assert.equal(result.longitude, 5.62);
    }
  });

  it("prefers a pasted pair over broken number fields", () => {
    const result = resolvePollingUnitCoordinates({
      latitude: "6.3346325, 5.6233922",
      longitude: "",
      paste: "6.3346325, 5.6233922",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.latitude, 6.3346325);
      assert.equal(result.longitude, 5.6233922);
    }
  });

  it("rejects coordinates outside Nigeria", () => {
    const result = resolvePollingUnitCoordinates({ latitude: "40.7", longitude: "-74.0" });
    assert.equal(result.ok, false);
  });

  it("treats blank as clearing the pin", () => {
    const result = resolvePollingUnitCoordinates({ latitude: "", longitude: "" });
    assert.deepEqual(result, { ok: true, latitude: null, longitude: null });
  });

  it("parses a lone coordinate field", () => {
    assert.equal(parseCoordinateField(" 6.5 "), 6.5);
    assert.equal(parseCoordinateField(""), null);
    assert.equal(parseCoordinateField("6.5, 5.6"), null);
  });
});
