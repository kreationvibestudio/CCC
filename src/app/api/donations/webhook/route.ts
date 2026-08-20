import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackSignature, verifyPaystackTransaction } from "@/lib/integrations/paystack/client";
import { recordSuccessfulPaystackCharge } from "@/lib/donations/record";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      customer?: { email?: string };
      metadata?: { full_name?: string; phone?: string; tenant_id?: string };
      channel?: string;
    };
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: payload.event ?? "unknown" });
  }

  const reference = payload.data?.reference?.trim();
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const verified = await verifyPaystackTransaction(reference);
  if ("error" in verified) {
    return NextResponse.json({ error: verified.error }, { status: 502 });
  }
  const charge = verified.data;
  if (charge.status !== "success") {
    return NextResponse.json({ ok: true, ignored: "not_success" });
  }

  const recorded = await recordSuccessfulPaystackCharge({
    reference: charge.reference,
    amountKobo: charge.amount,
    email: charge.customer?.email || "",
    fullName: typeof charge.metadata?.full_name === "string" ? charge.metadata.full_name : null,
    phone: typeof charge.metadata?.phone === "string" ? charge.metadata.phone : null,
    channel: charge.channel,
    tenantId: typeof charge.metadata?.tenant_id === "string" ? charge.metadata.tenant_id : null,
  });

  if ("error" in recorded) {
    return NextResponse.json({ error: recorded.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyRecorded: recorded.data.alreadyRecorded });
}
