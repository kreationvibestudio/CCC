import { requirePermission } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { getSecretsStatus } from "@/lib/admin/actions";
import { AdminView } from "@/components/admin/admin-view";
import { appBaseUrl, paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await requirePermission("admin.users");
  const supabase = await createClient();
  const [{ profiles, auditCount }, secrets, { data: linkSetting }, { data: tenant }] = await Promise.all([
    getAdminData(user.profile.tenant_id),
    getSecretsStatus(),
    supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", user.profile.tenant_id)
      .eq("key", "paystack_payment_link")
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("campaign_start_date, campaign_end_date, election_date")
      .eq("id", user.profile.tenant_id)
      .maybeSingle(),
  ]);
  const base = appBaseUrl();
  const storedLink =
    typeof linkSetting?.value === "string" ? linkSetting.value : "";
  return (
    <AdminView
      profiles={profiles}
      auditCount={auditCount}
      secrets={secrets}
      donateUrl={base && user.workspace?.slug ? `${base}/donate/${user.workspace.slug}` : ""}
      paystackCheckoutUrl={paystackPaymentLinkFromSetting(storedLink)}
      campaignStartDate={tenant?.campaign_start_date ?? null}
      campaignEndDate={tenant?.campaign_end_date ?? null}
      electionDate={tenant?.election_date ?? null}
    />
  );
}
