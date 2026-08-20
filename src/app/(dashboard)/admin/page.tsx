import { requirePermission } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { getSecretsStatus } from "@/lib/admin/actions";
import { AdminView } from "@/components/admin/admin-view";
import { appBaseUrl, paystackPaymentLink } from "@/lib/campaign";

export default async function AdminPage() {
  const user = await requirePermission("admin.users");
  const [{ profiles, auditCount }, secrets] = await Promise.all([
    getAdminData(user.profile.tenant_id),
    getSecretsStatus(),
  ]);
  const base = appBaseUrl();
  return (
    <AdminView
      profiles={profiles}
      auditCount={auditCount}
      secrets={secrets}
      donateUrl={base ? `${base}/donate` : ""}
      paystackCheckoutUrl={paystackPaymentLink()}
    />
  );
}
