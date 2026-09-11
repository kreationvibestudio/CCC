import { getCurrentUser } from "@/lib/auth/session";
import { getAnalyticsSummary } from "@/lib/analytics/data";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { hasPermission } from "@/types/auth";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  const summary = await getAnalyticsSummary(user!.profile.tenant_id);
  const canSeeDonations = user ? hasPermission(user.role, "donations.view") : false;
  if (!canSeeDonations) {
    summary.donationTrend = [];
    summary.fundraisingGoal = 0;
  }
  return <AnalyticsView summary={summary} />;
}
