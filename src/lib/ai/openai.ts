/** Shared OpenAI helpers for campaign AI features. Server-only. */

export function getOpenAiApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key || key === "[SENSITIVE]" || /^your[_-]/i.test(key)) return null;
  return key;
}

export function openAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type OpenAiChatResult =
  | { ok: true; text: string }
  | { ok: false; error: string; missingKey?: boolean };

function friendlyOpenAiError(status: number, body: unknown): string {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const err = rec.error && typeof rec.error === "object" ? (rec.error as Record<string, unknown>) : {};
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message : "";

  if (status === 401 || code === "invalid_api_key") {
    return "OpenAI rejected the API key (invalid or revoked). Update OPENAI_API_KEY in Vercel Production and redeploy.";
  }
  if (status === 429 || code === "insufficient_quota" || /quota|billing|rate limit/i.test(message)) {
    return "OpenAI quota or rate limit hit. Check billing/usage on the OpenAI account tied to this key.";
  }
  if (status === 404 || /model/i.test(message)) {
    return "OpenAI model is unavailable for this key. Confirm the project can use gpt-4o-mini.";
  }
  if (message) return `OpenAI error: ${message}`;
  return `OpenAI request failed (HTTP ${status}).`;
}

export async function openAiChatCompletion(input: {
  messages: ChatMessage[];
  temperature?: number;
  model?: string;
}): Promise<OpenAiChatResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      missingKey: true,
      error: "I'm your campaign assistant. Connect OPENAI_API_KEY for full AI responses.",
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? "gpt-4o-mini",
        temperature: input.temperature ?? 0.6,
        messages: input.messages,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: friendlyOpenAiError(res.status, json) };
    }

    const choices = Array.isArray(json.choices) ? json.choices : [];
    const first = choices[0] as { message?: { content?: string } } | undefined;
    const text = first?.message?.content?.trim() ?? "";
    if (!text) {
      return { ok: false, error: "OpenAI returned an empty response. Try again in a moment." };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, error: "AI service temporarily unavailable. Please try again." };
  }
}
