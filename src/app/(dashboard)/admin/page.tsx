import { getCurrentUser } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin/data";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const user = await getCurrentUser();
  const { profiles, auditCount } = await getAdminData(user!.profile.tenant_id);
  return <AdminView profiles={profiles} auditCount={auditCount} />;
}
