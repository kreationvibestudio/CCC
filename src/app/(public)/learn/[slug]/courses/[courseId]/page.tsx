import { redirect } from "next/navigation";
import { getLearnCourse, getLearnDashboard } from "@/lib/lms/learn";
import { LearnCoursePlayer } from "@/components/lms/learn-course-player";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const dash = await getLearnDashboard();
  if ("error" in dash) redirect(`/learn/${slug}/login`);
  const path = await getLearnCourse(courseId);
  if ("error" in path) redirect(`/learn/${slug}`);
  const completedIds = dash.progress.filter((p) => p.status === "completed").map((p) => p.module_id);
  return (
    <LearnCoursePlayer
      slug={slug}
      course={path.course!}
      modules={path.modules as Array<{
        id: string;
        slug: string;
        title: string;
        kind: string;
        body: string | null;
        resource_url: string | null;
        estimated_minutes: number | null;
        quiz: { questions?: Array<{ id: string; prompt: string; choices: string[] }> } | null;
      }>}
      completedIds={completedIds}
      enrollmentStatus={path.enrollment.status}
    />
  );
}
