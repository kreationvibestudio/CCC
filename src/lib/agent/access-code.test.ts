import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentCodeHint,
  formatAgentCode,
  generateAgentCode,
  hashAgentCode,
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
    assert.equal(
      validateAgentCodeLogin({ code: "abc", latitude: 6.5, longitude: 3.3 }),
      "Enter the 8-character agent code HQ gave you"
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

  it("generates an 8-character display code", () => {
    const code = generateAgentCode();
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(normalizeAgentCode(code).length, 8);
  });
});
