import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { decryptAgentCode, encryptAgentCode, isEncryptedAgentCode } from "./code-vault.ts";
import { generateAgentCode, normalizeAgentCode } from "./access-code.ts";

const KEY_A = Buffer.alloc(32, 7).toString("base64");
const KEY_B = Buffer.alloc(32, 9).toString("base64");
let originalKey: string | undefined;
let originalSeed: string | undefined;

before(() => {
  originalKey = process.env.AGENT_CODE_ENCRYPTION_KEY;
  originalSeed = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.AGENT_CODE_ENCRYPTION_KEY = KEY_A;
});

after(() => {
  if (originalKey === undefined) delete process.env.AGENT_CODE_ENCRYPTION_KEY;
  else process.env.AGENT_CODE_ENCRYPTION_KEY = originalKey;
  if (originalSeed === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSeed;
});

describe("agent code vault", () => {
  it("round-trips a code", () => {
    const code = generateAgentCode();
    const stored = encryptAgentCode(code);
    assert.ok(stored);
    assert.equal(decryptAgentCode(stored), normalizeAgentCode(code));
  });

  it("stores nothing resembling the code", () => {
    const code = generateAgentCode();
    const stored = encryptAgentCode(code) ?? "";
    assert.ok(isEncryptedAgentCode(stored));
    assert.ok(!stored.includes(normalizeAgentCode(code)));
  });

  it("uses a fresh nonce so the same code encrypts differently each time", () => {
    const code = "ABCDE-FGHJK";
    assert.notEqual(encryptAgentCode(code), encryptAgentCode(code));
  });

  it("refuses to decrypt with the wrong key instead of returning garbage", () => {
    const stored = encryptAgentCode("ABCDE-FGHJK");
    process.env.AGENT_CODE_ENCRYPTION_KEY = KEY_B;
    try {
      assert.equal(decryptAgentCode(stored), null);
    } finally {
      process.env.AGENT_CODE_ENCRYPTION_KEY = KEY_A;
    }
  });

  it("rejects a tampered ciphertext", () => {
    const stored = encryptAgentCode("ABCDE-FGHJK") ?? "";
    const parts = stored.split(":");
    const flipped = Buffer.from(parts[3]!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    parts[3] = flipped.toString("base64");
    assert.equal(decryptAgentCode(parts.join(":")), null);
  });

  it("passes through legacy plaintext rows so HQ keeps working", () => {
    assert.equal(decryptAgentCode("K7M2-P9QX"), "K7M2-P9QX");
    assert.equal(decryptAgentCode(null), null);
    assert.equal(decryptAgentCode("  "), null);
  });

  it("ignores stored values that are not a code at all", () => {
    assert.equal(decryptAgentCode("short"), null);
    assert.equal(decryptAgentCode("way-too-long-to-be-an-agent-code"), null);
  });

  it("derives a key from the service-role key when none is configured", () => {
    delete process.env.AGENT_CODE_ENCRYPTION_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests";
    try {
      const stored = encryptAgentCode("ABCDE-FGHJK");
      assert.ok(stored);
      assert.equal(decryptAgentCode(stored), "ABCDEFGHJK");
    } finally {
      process.env.AGENT_CODE_ENCRYPTION_KEY = KEY_A;
    }
  });

  it("stores nothing rather than plaintext when no key exists at all", () => {
    delete process.env.AGENT_CODE_ENCRYPTION_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      assert.equal(encryptAgentCode("ABCDE-FGHJK"), null);
    } finally {
      process.env.AGENT_CODE_ENCRYPTION_KEY = KEY_A;
    }
  });
});
