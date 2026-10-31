import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyPaystackTransaction } from "@/lib/integrations/paystack/client";
import { applyLicenseRenewalPayment } from "@/lib/licensing/service";

export default async function LicenseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = (params.reference || params.trxref || "").trim();

  if (!reference) {
    return (
      <Status
        ok={false}
        title="Missing payment reference"
        body="Return to Admin and start renewal again."
      />
    );
  }

  const verified = await verifyPaystackTransaction(reference);
  if ("error" in verified) {
    return <Status ok={false} title="Could not confirm payment" body={verified.error} />;
  }
  const charge = verified.data;
  if (charge.status !== "success") {
    return <Status ok={false} title="Payment not successful" body="Try renewing again from Admin." />;
  }

  const meta = (charge.metadata ?? {}) as Record<string, unknown>;
  const tenantId = typeof meta.tenant_id === "string" ? meta.tenant_id.trim() : "";
  if (!tenantId || String(meta.purpose ?? "") !== "tenant_license") {
    return (
      <Status
        ok={false}
        title="Not a license payment"
        body="This checkout was not for a CCC workspace license."
      />
    );
  }

  const applied = await applyLicenseRenewalPayment({
    tenantId,
    reference: charge.reference,
    amountNaira: charge.amount / 100,
    payerEmail: charge.customer?.email || "",
    payerName: typeof meta.full_name === "string" ? meta.full_name : null,
    channel: charge.channel ?? null,
  });
  if (applied.error) {
    return <Status ok={false} title="Payment received but license update failed" body={applied.error} />;
  }

  return (
    <Status
      ok
      title="License renewed"
      body={
        applied.licenseKey
          ? `Your workspace is licensed until ${
              applied.license?.expiresAt
                ? new Date(applied.license.expiresAt).toLocaleDateString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })
                : "next year"
            }. A copy of license ${applied.licenseKey} was emailed when Termii email is configured.`
          : "Your workspace license is active."
      }
    />
  );
}

function Status({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-4">
      <Card className="w-full">
        <CardContent className="space-y-4 pt-6 text-center">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
          <Button asChild variant={ok ? "default" : "outline"}>
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
