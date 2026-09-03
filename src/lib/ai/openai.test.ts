import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOpenAiApiKey, openAiConfigured, openAiChatCompletion } from "./openai.ts";

describe("openai helpers", () => {
  it("treats empty and placeholder keys as missing", () => {
    const prev = process.env.OPENAI_API_KEY;
    try {
      process.env.OPENAI_API_KEY = "";
      assert.equal(getOpenAiApiKey(), null);
      assert.equal(openAiConfigured(), false);

      process.env.OPENAI_API_KEY = "your-openai-key";
      assert.equal(getOpenAiApiKey(), null);

      process.env.OPENAI_API_KEY = "[SENSITIVE]";
      assert.equal(getOpenAiApiKey(), null);

      process.env.OPENAI_API_KEY = "  sk-test-key  ";
      assert.equal(getOpenAiApiKey(), "sk-test-key");
      assert.equal(openAiConfigured(), true);
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it("returns missing-key message without calling OpenAI", async () => {
    const prev = process.env.OPENAI_API_KEY;
    const prevFetch = globalThis.fetch;
    let called = false;
    try {
      delete process.env.OPENAI_API_KEY;
      globalThis.fetch = (async () => {
        called = true;
        throw new Error("should not fetch");
      }) as typeof fetch;

      const result = await openAiChatCompletion({
        messages: [{ role: "user", content: "hello" }],
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.missingKey, true);
        assert.match(result.error, /Connect OPENAI_API_KEY/);
      }
      assert.equal(called, false);
    } finally {
      globalThis.fetch = prevFetch;
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it("surfaces invalid key errors instead of the connect message", async () => {
    const prev = process.env.OPENAI_API_KEY;
    const prevFetch = globalThis.fetch;
    try {
      process.env.OPENAI_API_KEY = "sk-invalid";
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({ error: { code: "invalid_api_key", message: "Incorrect API key provided" } }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch;

      const result = await openAiChatCompletion({
        messages: [{ role: "user", content: "hello" }],
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.missingKey, undefined);
        assert.match(result.error, /rejected the API key/i);
        assert.doesNotMatch(result.error, /Connect OPENAI_API_KEY/);
      }
    } finally {
      globalThis.fetch = prevFetch;
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it("returns assistant text on success", async () => {
    const prev = process.env.OPENAI_API_KEY;
    const prevFetch = globalThis.fetch;
    try {
      process.env.OPENAI_API_KEY = "sk-valid";
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "  Campaign tip: focus on ward turnout.  " } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch;

      const result = await openAiChatCompletion({
        messages: [{ role: "user", content: "hello" }],
      });
      assert.deepEqual(result, { ok: true, text: "Campaign tip: focus on ward turnout." });
    } finally {
      globalThis.fetch = prevFetch;
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});
