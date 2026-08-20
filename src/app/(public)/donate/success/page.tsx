import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyPaystackTransaction } from "@/lib/integrations/paystack/client";
import { recordSuccessfulPaystackCharge } from "@/lib/donations/record";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Donation status | Campaign Command Center",
};

export const dynamic = "force-dynamic";

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = (params.reference || params.trxref || "").trim();

  if (!reference) {
    return (
      <StatusCard
        ok={false}
        title="No payment found"
        body="This page is used after Paystack checkout. Open the donate link to give again."
      />
    );
  }

  const verified = await verifyPaystackTransaction(reference);
  if ("error" in verified) {
    return <StatusCard ok={false} title="Could not confirm payment" body={verified.error} />;
  }

  const charge = verified.data;
  if (charge.status !== "success") {
    return (
      <StatusCard
        ok={false}
        title="Payment not completed"
        body="If you were charged, wait a minute and refresh this page. Otherwise try the donate page again."
      />
    );
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
    return (
      <StatusCard
        ok={false}
        title="Payment received, record pending"
        body="Paystack confirmed the charge. Refresh this page shortly; the campaign will still receive the gift."
      />
    );
  }

  return (
    <StatusCard
      ok
      title="Thank you"
      body={`Your ${formatCurrency(recorded.data.amount)} donation was received. A receipt was sent to your email by Paystack.`}
    />
  );
}

function StatusCard({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardContent className="space-y-4 pt-6 text-center">
          {ok ? (
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          ) : (
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
          )}
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
          <Button asChild variant={ok ? "default" : "outline"}>
            <Link href="/donate">{ok ? "Give again" : "Back to donate"}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
