import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackSignature, verifyPaystackTransaction } from "@/lib/integrations/paystack/client";
import { applyLicenseRenewalPayment } from "@/lib/licensing/service";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { event?: string; data?: { reference?: string } };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const reference = String(body.data?.reference ?? "").trim();
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const verified = await verifyPaystackTransaction(reference);
  if ("error" in verified) {
    return NextResponse.json({ error: verified.error }, { status: 502 });
  }
  const charge = verified.data;
  if (charge.status !== "success") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const meta = (charge.metadata ?? {}) as Record<string, unknown>;
  if (String(meta.purpose ?? "") !== "tenant_license") {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_license" });
  }

  const tenantId = String(meta.tenant_id ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant_id on license payment" }, { status: 400 });
  }

  const applied = await applyLicenseRenewalPayment({
    tenantId,
    reference: charge.reference,
    amountNaira: charge.amount / 100,
    payerEmail: charge.customer?.email || String(meta.email ?? ""),
    payerName: typeof meta.full_name === "string" ? meta.full_name : null,
    channel: charge.channel ?? null,
  });
  if (applied.error) {
    return NextResponse.json({ error: applied.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, licenseKey: applied.licenseKey });
}
