import { requirePermission } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { getSecretsStatus } from "@/lib/admin/actions";
import { AdminView } from "@/components/admin/admin-view";
import { appBaseUrl, paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await requirePermission("admin.users");
  const supabase = await createClient();
  const [{ profiles, auditCount }, secrets, { data: linkSetting }] = await Promise.all([
    getAdminData(user.profile.tenant_id),
    getSecretsStatus(),
    supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", user.profile.tenant_id)
      .eq("key", "paystack_payment_link")
      .maybeSingle(),
  ]);
  const base = appBaseUrl();
  const storedLink =
    typeof linkSetting?.value === "string" ? linkSetting.value : "";
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
    />
  );
}
