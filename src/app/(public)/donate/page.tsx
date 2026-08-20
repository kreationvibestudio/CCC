import { HeartHandshake } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DonateForm } from "@/components/donate/donate-form";
import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";
import { paystackSecretKey } from "@/lib/integrations/paystack/client";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Donate | Campaign Command Center",
  description: "Support the campaign with a secure Paystack donation.",
};

export const dynamic = "force-dynamic";

export default async function DonatePage() {
  const enabled = Boolean(paystackSecretKey());
  let campaignName = "the campaign";
  let goal = 0;
  let raised = 0;

  try {
    const admin = createServiceClient();
    const [{ data: tenant }, { data: donations }] = await Promise.all([
      admin.from("tenants").select("name, fundraising_goal").eq("id", CAMPAIGN_TENANT_ID).maybeSingle(),
      admin.from("donations").select("amount").eq("tenant_id", CAMPAIGN_TENANT_ID),
    ]);
    campaignName = tenant?.name?.trim() || campaignName;
    goal = Number(tenant?.fundraising_goal ?? 0);
    raised = (donations ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  } catch {
    // Page still renders if secrets are missing locally
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.15_255/0.08),transparent_50%)]" />
      <Card className="relative z-10 w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <HeartHandshake className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Support {campaignName}</CardTitle>
          <CardDescription>
            Secure checkout with Paystack. Cards, bank transfer, and USSD.
            {goal > 0 ? ` ${formatCurrency(raised)} of ${formatCurrency(goal)} raised.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!enabled && (
            <p className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Online giving is not open yet. Add a Paystack secret key, then share this page again.
            </p>
          )}
          <DonateForm enabled={enabled} />
        </CardContent>
      </Card>
    </div>
  );
}
