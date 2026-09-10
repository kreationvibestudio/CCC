import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTermiiWhatsAppTemplateData,
  buildTermiiWhatsAppTemplatePayload,
  compactTermiiSenderId,
  parseTermiiSendPayload,
  parseTermiiWhatsAppDataKeys,
  resolveTermiiSenderId,
  resolveTermiiWhatsAppConfig,
  sendTermiiSms,
  sendTermiiWhatsAppTemplate,
  termiiWhatsAppConfigured,
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

  it("accepts Termii WhatsApp array success payloads", () => {
    const result = parseTermiiSendPayload(
      200,
      JSON.stringify([
        {
          code: "ok",
          message_id: "2255298515609943356",
          message: "Successfully Sent",
        },
      ]),
      "secret-key"
    );
    assert.equal(result.ok, true);
    assert.equal(result.messageId, "2255298515609943356");
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

describe("Termii WhatsApp templates", () => {
  it("defaults data keys to name, code, url", () => {
    assert.deepEqual(parseTermiiWhatsAppDataKeys(""), ["name", "code", "url"]);
    assert.deepEqual(parseTermiiWhatsAppDataKeys("1,2,3"), ["1", "2", "3"]);
  });

  it("maps name, code, and url onto template keys in order", () => {
    assert.deepEqual(
      buildTermiiWhatsAppTemplateData(["name", "code", "url"], {
        name: "Ada",
        code: "ABCD-EFGH",
        url: "https://ccc.example/learn/campaign/login",
      }),
      {
        name: "Ada",
        code: "ABCD-EFGH",
        url: "https://ccc.example/learn/campaign/login",
      }
    );
    assert.deepEqual(
      buildTermiiWhatsAppTemplateData(["1", "2", "3"], {
        name: "Ada",
        code: "ABCD-EFGH",
        url: "https://ccc.example/learn/campaign/login",
      }),
      {
        "1": "Ada",
        "2": "ABCD-EFGH",
        "3": "https://ccc.example/learn/campaign/login",
      }
    );
  });

  it("builds the Termii template POST body", () => {
    const payload = buildTermiiWhatsAppTemplatePayload(
      {
        apiKey: "secret-key",
        deviceId: "device-1",
        templateId: "tpl-9",
        dataKeys: ["name", "code", "url"],
      },
      "2348031234567",
      { name: "Ada", code: "ABCD-EFGH", url: "https://example.test/learn/x/login" }
    );
    assert.deepEqual(payload, {
      phone_number: "2348031234567",
      device_id: "device-1",
      template_id: "tpl-9",
      api_key: "secret-key",
      data: {
        name: "Ada",
        code: "ABCD-EFGH",
        url: "https://example.test/learn/x/login",
      },
    });
  });

  it("reports WhatsApp as unconfigured when device or template is missing", () => {
    const prevKey = process.env.TERMII_API_KEY;
    const prevDevice = process.env.TERMII_WHATSAPP_DEVICE_ID;
    const prevTemplate = process.env.TERMII_WHATSAPP_TEMPLATE_ID;
    process.env.TERMII_API_KEY = "not-a-real-key";
    delete process.env.TERMII_WHATSAPP_DEVICE_ID;
    delete process.env.TERMII_WHATSAPP_TEMPLATE_ID;
    try {
      assert.equal(termiiWhatsAppConfigured(), false);
      const config = resolveTermiiWhatsAppConfig();
      assert.equal("error" in config, true);
    } finally {
      if (prevKey === undefined) delete process.env.TERMII_API_KEY;
      else process.env.TERMII_API_KEY = prevKey;
      if (prevDevice === undefined) delete process.env.TERMII_WHATSAPP_DEVICE_ID;
      else process.env.TERMII_WHATSAPP_DEVICE_ID = prevDevice;
      if (prevTemplate === undefined) delete process.env.TERMII_WHATSAPP_TEMPLATE_ID;
      else process.env.TERMII_WHATSAPP_TEMPLATE_ID = prevTemplate;
    }
  });

  it("does not treat an empty 401 as a successful WhatsApp send", async () => {
    const prev = {
      key: process.env.TERMII_API_KEY,
      device: process.env.TERMII_WHATSAPP_DEVICE_ID,
      template: process.env.TERMII_WHATSAPP_TEMPLATE_ID,
    };
    process.env.TERMII_API_KEY = "not-a-real-key";
    process.env.TERMII_WHATSAPP_DEVICE_ID = "device-1";
    process.env.TERMII_WHATSAPP_TEMPLATE_ID = "tpl-9";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      assert.equal(String(input), "https://api.ng.termii.com/api/send/template");
      assert.equal(body.phone_number, "2348031234567");
      assert.equal(body.device_id, "device-1");
      return new Response("", { status: 401 });
    }) as typeof fetch;
    try {
      const result = await sendTermiiWhatsAppTemplate({
        to: "08031234567",
        name: "Ada",
        code: "ABCD-EFGH",
        url: "https://example.test/learn/x/login",
      });
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /API key/);
    } finally {
      globalThis.fetch = originalFetch;
      if (prev.key === undefined) delete process.env.TERMII_API_KEY;
      else process.env.TERMII_API_KEY = prev.key;
      if (prev.device === undefined) delete process.env.TERMII_WHATSAPP_DEVICE_ID;
      else process.env.TERMII_WHATSAPP_DEVICE_ID = prev.device;
      if (prev.template === undefined) delete process.env.TERMII_WHATSAPP_TEMPLATE_ID;
      else process.env.TERMII_WHATSAPP_TEMPLATE_ID = prev.template;
    }
  });
});
