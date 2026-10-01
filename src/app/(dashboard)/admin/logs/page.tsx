import { requirePermission } from "@/lib/auth/session";
import { getAdminSystemLog } from "@/lib/admin/system-log";
import { AdminSystemLogView } from "@/components/admin/admin-system-log-view";

export default async function AdminSystemLogPage() {
  const user = await requirePermission("admin.users");
  const entries = await getAdminSystemLog(user.profile.tenant_id);
  return <AdminSystemLogView entries={entries} />;
}
