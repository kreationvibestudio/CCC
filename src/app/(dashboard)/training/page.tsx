import { getTrainingOverview } from "@/lib/lms/hq-data";
import { TrainingManagementView } from "@/components/lms/training-management-view";
import { TrainingSchemaSetup } from "@/components/lms/training-schema-setup";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteRecords, hasPermission } from "@/types/auth";
import { appBaseUrl } from "@/lib/campaign";

export default async function TrainingManagementPage() {
  const user = await getCurrentUser();
  const overview = await getTrainingOverview();
  if ("error" in overview) {
    return <TrainingSchemaSetup message={overview.error || "Could not load training catalog. Apply the LMS SQL in Supabase."} />;
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
      canWrite={user ? canWriteRecords(user.role) && hasPermission(user.role, "training.manage") : false}
    />
  );
}
