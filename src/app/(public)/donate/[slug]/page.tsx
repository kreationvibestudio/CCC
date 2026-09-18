import { BrandLogo } from "@/components/brand/logo";
import { createServiceClient } from "@/lib/supabase/admin";
import { paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { notFound } from "next/navigation";
import { PublicDonateForm } from "@/components/donations/public-donate-form";
import { PublicFundraisingMeter } from "@/components/donations/public-fundraising-meter";

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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.42_0.12_145/0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,transparent_35%,oklch(0.35_0.08_85/0.1))]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <section className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-end px-4 pb-8 pt-16 sm:justify-center sm:pt-20">
        <div className="mb-8 flex flex-col items-start gap-5">
          <BrandLogo size={72} className="rounded-xl shadow-lg shadow-emerald-900/20" priority />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
              {campaignName}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Support the campaign</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              Every gift fuels field work across Edo. Pay securely with card, bank transfer, or USSD.
            </p>
          </div>
          <PublicFundraisingMeter raised={raised} goal={goal} prominent />
        </div>

        <div
          id="donate"
          className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-xl backdrop-blur sm:p-6"
        >
          <PublicDonateForm slug={slug} fallbackCheckoutUrl={checkoutUrl} />
        </div>
      </section>
    </div>
  );
}
