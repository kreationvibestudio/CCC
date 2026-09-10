import { redirect } from "next/navigation";
import { getLearnDashboard, getLearnSession } from "@/lib/lms/learn";
import { LearnDashboardView } from "@/components/lms/learn-dashboard";

export default async function LearnHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getLearnSession();
  if (!session) redirect(`/learn/${slug}/login`);
  const dash = await getLearnDashboard();
  if ("error" in dash) redirect(`/learn/${slug}/login`);
  return (
    <LearnDashboardView
      slug={slug}
      campaign={dash.campaign}
      volunteer={dash.volunteer}
      roles={dash.roles}
      paths={dash.paths}
      certificates={dash.certificates as Array<{ id: string; course_id: string; code: string; issued_at: string }>}
      sessions={dash.sessions as Array<{ id: string; title: string; starts_at: string; location: string | null; meeting_url: string | null; follow_up: string | null }>}
      rsvps={dash.rsvps as Array<{ session_id: string; status: string }>}
    />
  );
}
