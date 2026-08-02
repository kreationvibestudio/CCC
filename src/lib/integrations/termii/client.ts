const TERMII_BASE = "https://api.ng.termii.com/api";

export interface TermiiSendResult {
  message_id?: string;
  message?: string;
  code?: string;
}

export async function sendTermiiSms(to: string, message: string): Promise<TermiiSendResult> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID ?? "CCC";
  if (!apiKey) throw new Error("TERMII_API_KEY not configured");

  const phone = to.startsWith("+") ? to.replace("+", "") : to.startsWith("234") ? to : `234${to.replace(/^0/, "")}`;

  const res = await fetch(`${TERMII_BASE}/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: phone,
      from: senderId,
      sms: message,
      type: "plain",
      channel: "generic",
    }),
  });
  return res.json();
}

export function renderTemplate(body: string, vars: Record<string, string>) {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  return out;
}
