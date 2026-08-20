import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/campaign";
import { initializePaystackTransaction, paystackSecretKey } from "@/lib/integrations/paystack/client";

const MIN_NAIRA = 100;
const MAX_NAIRA = 10_000_000;

export async function POST(req: NextRequest) {
  if (!paystackSecretKey()) {
    return NextResponse.json(
      { error: "Online donations are not open yet. Set PAYSTACK_SECRET_KEY on Vercel." },
      { status: 503 }
    );
  }

  const base = appBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set. Use the production Vercel URL." },
      { status: 503 }
    );
  }

  let body: { amount?: unknown; email?: unknown; fullName?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const amountNaira = Number(body.amount);
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (!Number.isFinite(amountNaira) || amountNaira < MIN_NAIRA || amountNaira > MAX_NAIRA) {
    return NextResponse.json(
      { error: `Amount must be between ₦${MIN_NAIRA.toLocaleString()} and ₦${MAX_NAIRA.toLocaleString()}` },
      { status: 400 }
    );
  }

  const result = await initializePaystackTransaction({
    email,
    amountNaira: Math.round(amountNaira),
    callbackUrl: `${base}/donate/success`,
    metadata: {
      full_name: fullName,
      phone: phone || undefined,
    },
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
  });
}
