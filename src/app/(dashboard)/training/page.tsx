import { getTrainingOverview } from "@/lib/lms/actions";
import { TrainingManagementView } from "@/components/lms/training-management-view";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteRecords } from "@/types/auth";
import { appBaseUrl } from "@/lib/campaign";

export default async function TrainingManagementPage() {
  const user = await getCurrentUser();
  const overview = await getTrainingOverview();
  if ("error" in overview) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-2xl font-bold">Training Management</h1>
        <p className="text-sm text-muted-foreground">{overview.error}</p>
      </div>
    );
  }
  const base =
    appBaseUrl() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  const learnBase = base && user?.workspace?.slug ? `${base}/learn/${user.workspace.slug}/login` : "";
  return (
    <TrainingManagementView
      stats={overview.stats}
      courses={overview.courses}
      volunteers={overview.volunteers}
      enrollments={overview.enrollments}
      byRole={overview.byRole}
      byLga={overview.byLga}
      overdue={overview.overdue}
      sessions={overview.sessions}
      logs={overview.logs}
      learnBase={learnBase}
      canWrite={user ? canWriteRecords(user.role) : false}
    />
  );
}
