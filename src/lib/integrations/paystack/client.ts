import { createHmac, timingSafeEqual } from "crypto";

const PAYSTACK_API = "https://api.paystack.co";

export function paystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!key || key === "[SENSITIVE]" || /^your[_-]/i.test(key)) return null;
  return key;
}

function headers(secret: string) {
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

export type PaystackCharge = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  channel?: string;
  customer?: { email?: string };
  metadata?: Record<string, unknown> | null;
};

export async function initializePaystackTransaction(input: {
  email: string;
  amountNaira: number;
  callbackUrl: string;
  metadata: Record<string, string | undefined>;
}): Promise<{ data: { authorization_url: string; access_code: string; reference: string } } | { error: string }> {
  const secret = paystackSecretKey();
  if (!secret) {
    return { error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY on Vercel." };
  }

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: headers(secret),
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountNaira * 100),
      currency: "NGN",
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
    }),
  });

  const json = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!res.ok || !json.status || !json.data?.authorization_url) {
    return { error: json.message || "Could not start Paystack checkout" };
  }

  return { data: json.data };
}

export async function verifyPaystackTransaction(
  reference: string
): Promise<{ data: PaystackCharge } | { error: string }> {
  const secret = paystackSecretKey();
  if (!secret) return { error: "Paystack is not configured" };

  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(secret),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: PaystackCharge;
  };

  if (!res.ok || !json.status || !json.data) {
    return { error: json.message || "Could not verify payment" };
  }

  return { data: json.data };
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = paystackSecretKey();
  if (!secret || !signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
