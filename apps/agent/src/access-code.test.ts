import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_CODE_LENGTH,
  formatCodeInput,
  isAgentCodeShape,
  normalizeAgentCode,
} from "./access-code.ts";

describe("agent app access codes", () => {
  it("accepts both 8-character legacy codes and 10-character HQ codes", () => {
    assert.equal(isAgentCodeShape("K7M2-P9QX"), true);
    assert.equal(isAgentCodeShape("ABCDE-FGHIJ"), true);
    assert.equal(isAgentCodeShape("ABC"), false);
    assert.equal(isAgentCodeShape("ABCDEFGHI"), false);
  });

  it("formats typed input and caps at the current HQ length", () => {
    assert.equal(formatCodeInput("k7m2p9qx"), "K7M2-P9QX");
    assert.equal(formatCodeInput("abcdefghij"), "ABCDE-FGHIJ");
    assert.equal(normalizeAgentCode(formatCodeInput("abcdefghijkl")).length, AGENT_CODE_LENGTH);
  });
});
