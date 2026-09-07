const TERMII_BASE = "https://api.ng.termii.com/api";

export type TermiiSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** Raw Termii payload for logging. Never shown as-is in HQ. */
  raw?: Record<string, unknown>;
};

export type TermiiAccount = {
  ok: boolean;
  error?: string;
  balance?: number;
  currency?: string;
};

function resolveTermiiApiKey(raw = process.env.TERMII_API_KEY): string | null {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed || null;
}

/** Termii alphanumeric sender IDs are 3–11 letters/numbers. Spaces are rejected. */
export function compactTermiiSenderId(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
}

export function resolveTermiiSenderId(
  raw = process.env.TERMII_SENDER_ID
): { senderId: string } | { error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return {
      error:
        "TERMII_SENDER_ID is not set. Add the approved sender ID in Vercel (3–11 letters or numbers, no spaces).",
    };
  }
  const compact = compactTermiiSenderId(trimmed);
  if (compact.length < 3) {
    return {
      error:
        "TERMII_SENDER_ID is too short after cleanup. Termii needs 3–11 letters or numbers (example: HoR2027).",
    };
  }
  return { senderId: compact };
}

export function termiiSenderIdConfigured(raw = process.env.TERMII_SENDER_ID): boolean {
  return !("error" in resolveTermiiSenderId(raw));
}

/** Nigeria MSISDN for Termii: 234 + 10 subscriber digits. */
export function toTermiiMsisdn(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("2340") && digits.length >= 14) {
    digits = `234${digits.slice(4)}`;
  }
  if (digits.startsWith("234") && digits.length >= 13) {
    return digits.slice(0, 13);
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `234${digits.slice(1)}`;
  }
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `234${digits}`;
  }
  return null;
}

function redactSecrets(text: string, apiKey: string | null): string {
  let out = text.replace(/\s+/g, " ").trim();
  if (apiKey && apiKey.length >= 6) {
    out = out.split(apiKey).join("[TERMII_API_KEY]");
  }
  return out.slice(0, 240);
}

function publicTermiiError(status: number, payload: Record<string, unknown> | null, apiKey: string | null): string {
  const hinted =
    (typeof payload?.message === "string" && payload.message.trim()) ||
    (typeof payload?.error === "string" && payload.error.trim()) ||
    "";
  const clean = redactSecrets(hinted, apiKey);
  if (status === 401 || /unauthor|invalid api|api key/i.test(clean)) {
    return "Termii rejected the API key (HTTP 401). Update TERMII_API_KEY in Vercel and redeploy.";
  }
  if (/sender/i.test(clean)) {
    return clean || "Termii rejected the sender ID. Register TERMII_SENDER_ID (3–11 letters or numbers, no spaces).";
  }
  if (/balance|insufficient|credit/i.test(clean)) {
    return clean || "Termii wallet has no credit.";
  }
  if (/phone|destination|recipient|msisdn/i.test(clean)) {
    return clean || "Termii rejected the phone number. Use a Nigerian number such as 0803… or 234803….";
  }
  if (clean) return clean;
  if (status === 402) return "Termii wallet has no credit.";
  if (status >= 500) return "Termii is unavailable. Try again shortly.";
  if (!payload) {
    return `Termii returned HTTP ${status} with an empty body. Check TERMII_API_KEY and the approved sender ID.`;
  }
  return `Termii rejected the send (HTTP ${status}).`;
}

export function parseTermiiSendPayload(
  status: number,
  bodyText: string,
  apiKey: string | null
): TermiiSendResult {
  let payload: Record<string, unknown> | null = null;
  const trimmed = bodyText.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, error: publicTermiiError(status, null, apiKey) };
    }
  }

  const messageId = String(payload?.message_id ?? payload?.message_id_str ?? "").trim();
  const code = String(payload?.code ?? "").toLowerCase();
  const ok = Boolean(messageId) || code === "ok";
  if (ok && (status < 200 || status >= 300) && code !== "ok") {
    return { ok: false, error: publicTermiiError(status, payload, apiKey), raw: payload ?? undefined };
  }
  if (ok) {
    return { ok: true, messageId: messageId || undefined, raw: payload ?? undefined };
  }
  return { ok: false, error: publicTermiiError(status, payload, apiKey), raw: payload ?? undefined };
}

function termiiChannel(): "generic" | "dnd" {
  const raw = (process.env.TERMII_CHANNEL ?? "generic").trim().toLowerCase();
  return raw === "dnd" ? "dnd" : "generic";
}

export async function getTermiiAccount(): Promise<TermiiAccount> {
  const apiKey = resolveTermiiApiKey();
  if (!apiKey) {
    return { ok: false, error: "TERMII_API_KEY is not configured. Add it in Vercel env or .env.local." };
  }
  const sender = resolveTermiiSenderId();
  if ("error" in sender) return { ok: false, error: sender.error };

  const url = new URL(`${TERMII_BASE}/get-balance`);
  url.searchParams.set("api_key", apiKey);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", cache: "no-store" });
  } catch {
    return { ok: false, error: "Could not reach Termii. Check outbound network / DNS." };
  }
  const text = await res.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  if (res.status === 401 || !res.ok) {
    return { ok: false, error: publicTermiiError(res.status, payload, apiKey) };
  }
  const balance = typeof payload?.balance === "number" ? payload.balance : Number(payload?.balance);
  return {
    ok: true,
    balance: Number.isFinite(balance) ? balance : undefined,
    currency: typeof payload?.currency === "string" ? payload.currency : "NGN",
  };
}

export async function sendTermiiSms(to: string, message: string): Promise<TermiiSendResult> {
  const apiKey = resolveTermiiApiKey();
  if (!apiKey) {
    return { ok: false, error: "TERMII_API_KEY is not configured. Add it in Vercel env or .env.local." };
  }
  const sender = resolveTermiiSenderId();
  if ("error" in sender) return { ok: false, error: sender.error };

  const phone = toTermiiMsisdn(to);
  if (!phone) {
    return {
      ok: false,
      error: `Phone “${to.trim() || "(empty)"}” is not a Nigerian mobile number. Use 0803… or 234803….`,
    };
  }

  const sms = message.trim();
  if (!sms) return { ok: false, error: "SMS body is empty." };

  let res: Response;
  try {
    res = await fetch(`${TERMII_BASE}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: sender.senderId,
        sms,
        type: "plain",
        channel: termiiChannel(),
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach Termii. Check outbound network / DNS." };
  }

  return parseTermiiSendPayload(res.status, await res.text(), apiKey);
}

export function renderTemplate(body: string, vars: Record<string, string>) {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  return out;
}
