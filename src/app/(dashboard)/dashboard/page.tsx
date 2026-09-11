import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard-data";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { hasPermission } from "@/types/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = await getDashboardData(user!.profile.tenant_id);
  const canSeeDonations = user ? hasPermission(user.role, "donations.view") : false;
  if (!canSeeDonations) {
    data.stats.donations = 0;
    data.stats.fundraisingGoal = 0;
  }
  return <DashboardView data={data} canSeeDonations={canSeeDonations} />;
}
