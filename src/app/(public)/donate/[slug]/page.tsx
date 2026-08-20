import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/admin";
import { paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function settingString(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value) return String((value as { url: string }).url);
  return "";
}

export default async function DonateSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createServiceClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, fundraising_goal")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const [{ data: donations }, { data: linkSetting }] = await Promise.all([
    admin.from("donations").select("amount").eq("tenant_id", tenant.id),
    admin
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", tenant.id)
      .eq("key", "paystack_payment_link")
      .maybeSingle(),
  ]);

  const checkoutUrl = paystackPaymentLinkFromSetting(settingString(linkSetting?.value));
  const goal = Number(tenant.fundraising_goal ?? 0);
  const raised = (donations ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const campaignName = tenant.name?.trim() || "the campaign";

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
            Checkout is on Paystack. Enter your name, email, and amount, then pay by card, bank
            transfer, or USSD.
            {goal > 0 ? ` ${formatCurrency(raised)} of ${formatCurrency(goal)} raised.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <a href={checkoutUrl}>Donate with Paystack</a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You will complete payment on Paystack. A receipt is emailed after a successful gift.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
