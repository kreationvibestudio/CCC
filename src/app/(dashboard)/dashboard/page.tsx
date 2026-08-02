import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard-data";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = await getDashboardData(user!.profile.tenant_id);
  return <DashboardView data={data} />;
}
