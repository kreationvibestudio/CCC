import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactTermiiSenderId,
  parseTermiiSendPayload,
  resolveTermiiSenderId,
  sendTermiiSms,
  toTermiiMsisdn,
} from "./client.ts";

describe("toTermiiMsisdn", () => {
  it("accepts common Nigerian formats", () => {
    assert.equal(toTermiiMsisdn("08031234567"), "2348031234567");
    assert.equal(toTermiiMsisdn("+234 803 123 4567"), "2348031234567");
    assert.equal(toTermiiMsisdn("2348031234567"), "2348031234567");
    assert.equal(toTermiiMsisdn("8031234567"), "2348031234567");
    assert.equal(toTermiiMsisdn("23408031234567"), "2348031234567");
  });

  it("rejects junk", () => {
    assert.equal(toTermiiMsisdn(""), null);
    assert.equal(toTermiiMsisdn("123"), null);
    assert.equal(toTermiiMsisdn("not-a-phone"), null);
  });
});

describe("resolveTermiiSenderId", () => {
  it("strips spaces so HoR 2027 becomes HoR2027", () => {
    assert.deepEqual(resolveTermiiSenderId("HoR 2027"), { senderId: "HoR2027" });
    assert.equal(compactTermiiSenderId("HoR 2027"), "HoR2027");
  });

  it("rejects empty or too-short IDs", () => {
    assert.equal("error" in resolveTermiiSenderId(""), true);
    assert.equal("error" in resolveTermiiSenderId("  AB  "), true);
  });
});

describe("parseTermiiSendPayload", () => {
  it("treats empty HTTP 401 as a rejected API key", () => {
    const result = parseTermiiSendPayload(401, "", "secret-key");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /API key/);
  });

  it("accepts Termii success payloads", () => {
    const result = parseTermiiSendPayload(
      200,
      JSON.stringify({
        code: "ok",
        message_id: "3017544054459083819856413",
        message: "Successfully Sent",
      }),
      "secret-key"
    );
    assert.equal(result.ok, true);
    assert.equal(result.messageId, "3017544054459083819856413");
  });

  it("surfaces sender-ID errors without leaking the key", () => {
    const result = parseTermiiSendPayload(
      400,
      JSON.stringify({ message: "Invalid Sender ID secret-key" }),
      "secret-key"
    );
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Sender ID/);
    assert.equal((result.error ?? "").includes("secret-key"), false);
  });
});

describe("sendTermiiSms", () => {
  it("does not treat an empty 401 as success", async () => {
    const prevKey = process.env.TERMII_API_KEY;
    const prevSender = process.env.TERMII_SENDER_ID;
    process.env.TERMII_API_KEY = "not-a-real-key";
    process.env.TERMII_SENDER_ID = "HoR 2027";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("", { status: 401 })) as typeof fetch;
    try {
      const result = await sendTermiiSms("08031234567", "Hello from CCC");
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /API key/);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey === undefined) delete process.env.TERMII_API_KEY;
      else process.env.TERMII_API_KEY = prevKey;
      if (prevSender === undefined) delete process.env.TERMII_SENDER_ID;
      else process.env.TERMII_SENDER_ID = prevSender;
    }
  });
});
