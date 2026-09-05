import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentCodeExpiry,
  agentCodeHint,
  AGENT_CODE_LENGTH,
  AGENT_CODE_TTL_DAYS,
  formatAgentCode,
  generateAgentCode,
  hashAgentCode,
  isAgentCodeExpired,
  isAgentCodeShape,
  normalizeAgentCode,
  validateAgentCodeLogin,
} from "./access-code.ts";

describe("agent access codes", () => {
  it("normalizes dashes and lowercase", () => {
    assert.equal(normalizeAgentCode("k7m2-p9qx"), "K7M2P9QX");
    assert.equal(formatAgentCode("k7m2p9qx"), "K7M2-P9QX");
    assert.equal(isAgentCodeShape("K7M2-P9QX"), true);
    assert.equal(isAgentCodeShape("123"), false);
  });

  it("hashes stably and hides all but the last four", () => {
    assert.equal(hashAgentCode("K7M2-P9QX"), hashAgentCode("k7m2p9qx"));
    assert.notEqual(hashAgentCode("K7M2-P9QX"), hashAgentCode("K7M2-P9QY"));
    assert.equal(agentCodeHint("K7M2-P9QX"), "P9QX");
  });

  it("rejects short codes; GPS optional unless required", () => {
    assert.match(
      validateAgentCodeLogin({ code: "abc", latitude: 6.5, longitude: 3.3 }) ?? "",
      /agent code/i
    );
    assert.equal(validateAgentCodeLogin({ code: "K7M2-P9QX", latitude: null, longitude: null }), null);
    assert.match(
      validateAgentCodeLogin({
        code: "K7M2-P9QX",
        latitude: Number.NaN,
        longitude: 3.3,
        requireGps: true,
      }) ?? "",
      /location/i
    );
    assert.equal(validateAgentCodeLogin({ code: "K7M2-P9QX", latitude: 6.5, longitude: 3.3 }), null);
  });

  it("generates a 10-character display code", () => {
    const code = generateAgentCode();
    assert.match(code, /^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    assert.equal(normalizeAgentCode(code).length, AGENT_CODE_LENGTH);
    assert.equal(isAgentCodeShape(code), true);
  });

  it("keeps accepting the 8-character codes issued before the change", () => {
    assert.equal(isAgentCodeShape("K7M2-P9QX"), true);
    assert.equal(formatAgentCode("K7M2P9QX"), "K7M2-P9QX");
  });

  it("excludes characters that are misread aloud", () => {
    const sample = Array.from({ length: 200 }, () => normalizeAgentCode(generateAgentCode())).join("");
    assert.doesNotMatch(sample, /[OIL01U]/, "ambiguous characters must not appear");
  });

  it("draws from the whole alphabet rather than a biased slice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      for (const char of normalizeAgentCode(generateAgentCode())) seen.add(char);
    }
    assert.equal(seen.size, 30, "rejection sampling should reach every symbol");
  });

  it("never repeats a code across many draws", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateAgentCode()));
    assert.equal(codes.size, 500);
  });
});

describe("agent code expiry", () => {
  it("issues codes with a bounded lifetime", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const expiry = agentCodeExpiry(from);
    const days = (expiry.getTime() - from.getTime()) / 86400000;
    assert.equal(days, AGENT_CODE_TTL_DAYS);
  });

  it("treats a past expiry as expired and a future one as valid", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    assert.equal(isAgentCodeExpired("2026-05-31T23:59:59Z", now), true);
    assert.equal(isAgentCodeExpired("2026-06-02T00:00:00Z", now), false);
  });

  it("treats a missing or unparseable expiry as no expiry", () => {
    // Rows written before the expires_at column must keep working.
    assert.equal(isAgentCodeExpired(null), false);
    assert.equal(isAgentCodeExpired(undefined), false);
    assert.equal(isAgentCodeExpired("not a date"), false);
  });
});
