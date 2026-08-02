import { getCurrentUser } from "@/lib/auth/session";
import { getAnalyticsSummary } from "@/lib/analytics/data";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  const summary = await getAnalyticsSummary(user!.profile.tenant_id);
  return <AnalyticsView summary={summary} />;
}
