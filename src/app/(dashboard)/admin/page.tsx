import { requirePermission } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { getSecretsStatus } from "@/lib/admin/actions";
import { AdminView } from "@/components/admin/admin-view";
import { appBaseUrl, paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { createClient } from "@/lib/supabase/server";
import { isMissingColumnError } from "@/lib/public-error";

function settingText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.url === "string") return row.url.trim();
    if (typeof row.value === "string") return row.value.trim();
  }
  return "";
}

export default async function AdminPage() {
  const user = await requirePermission("admin.users");
  const supabase = await createClient();
  const [{ profiles, auditCount }, secrets, { data: settings }] = await Promise.all([
    getAdminData(user.profile.tenant_id),
    getSecretsStatus(),
    supabase
      .from("tenant_settings")
      .select("key, value")
      .eq("tenant_id", user.profile.tenant_id)
      .in("key", ["paystack_payment_link", "campaign_website"]),
  ]);
  const byKey = new Map((settings ?? []).map((row) => [row.key as string, row.value]));
  const storedLink = settingText(byKey.get("paystack_payment_link"));
  const campaignWebsite = settingText(byKey.get("campaign_website"));

  const withStart = await supabase
    .from("tenants")
    .select("campaign_start_date, campaign_end_date, election_date")
    .eq("id", user.profile.tenant_id)
    .maybeSingle();
  const tenantRes = isMissingColumnError(withStart.error?.message, "campaign_start_date")
    ? await supabase
        .from("tenants")
        .select("campaign_end_date, election_date")
        .eq("id", user.profile.tenant_id)
        .maybeSingle()
    : withStart;
  const tenant = tenantRes.data as {
    campaign_start_date?: string | null;
    campaign_end_date?: string | null;
    election_date?: string | null;
  } | null;
  const needsCampaignStartMigration = isMissingColumnError(withStart.error?.message, "campaign_start_date");

  const base = appBaseUrl();
  const publicBase =
    base ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  return (
    <AdminView
      profiles={profiles}
      auditCount={auditCount}
      secrets={secrets}
      donateUrl={base && user.workspace?.slug ? `${base}/donate/${user.workspace.slug}` : ""}
      volunteerUrl={
        publicBase && user.workspace?.slug ? `${publicBase}/volunteer/${user.workspace.slug}` : ""
      }
      paystackCheckoutUrl={paystackPaymentLinkFromSetting(storedLink)}
      campaignWebsite={campaignWebsite}
      campaignStartDate={tenant?.campaign_start_date ?? null}
      campaignEndDate={tenant?.campaign_end_date ?? null}
      electionDate={tenant?.election_date ?? null}
      needsCampaignStartMigration={needsCampaignStartMigration}
      currentUserId={user.id}
    />
  );
}
