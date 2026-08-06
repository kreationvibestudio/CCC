import { requirePermission } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { getSecretsStatus } from "@/lib/admin/actions";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const user = await requirePermission("admin.users");
  const [{ profiles, auditCount }, secrets] = await Promise.all([
    getAdminData(user.profile.tenant_id),
    getSecretsStatus(),
  ]);
  return <AdminView profiles={profiles} auditCount={auditCount} secrets={secrets} />;
}
