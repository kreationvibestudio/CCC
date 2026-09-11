export type EnrollmentStatus = "assigned" | "in_progress" | "completed" | "removed";

export function percentComplete(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

export function scorePercent(correct: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function quizPassed(score: number, passMark: number) {
  return score >= passMark;
}

export function canRetryQuiz(attempts: number, maxAttempts: number) {
  return attempts < maxAttempts;
}

export function requiredCoursesComplete(
  enrollments: Array<{ required: boolean; status: string }>
) {
  const required = enrollments.filter((e) => e.required && e.status !== "removed");
  if (required.length === 0) return false;
  return required.every((e) => e.status === "completed");
}

export function overallPathStatus(
  enrollments: Array<{ required: boolean; status: string }>
): EnrollmentStatus | "none" {
  const active = enrollments.filter((e) => e.status !== "removed");
  if (active.length === 0) return "none";
  if (requiredCoursesComplete(active)) return "completed";
  if (active.some((e) => e.status === "in_progress" || e.status === "completed")) return "in_progress";
  return "assigned";
}

/**
 * Persistable HQ status from LMS enrollments.
 * Keep a manual HQ "completed" mark unless the volunteer is actively retaking a course.
 */
export function nextTrainingStatusFromLms(input: {
  stored: string | null | undefined;
  enrollments: Array<{ required: boolean; status: string }>;
}): "pending" | "in_progress" | "completed" {
  const active = input.enrollments.filter((e) => e.status !== "removed");
  const ready = requiredCoursesComplete(active);
  const started = active.some((e) => e.status === "in_progress" || e.status === "completed");
  if (ready) return "completed";
  if (started) return "in_progress";
  if (input.stored === "completed") return "completed";
  if (input.stored === "in_progress") return "in_progress";
  return "pending";
}

/** HQ briefing flag plus LMS enrollments. Completing a course is In progress, not still Pending. */
export function effectiveTrainingStatus(
  stored: string | null | undefined,
  enrollments: Array<{ required: boolean; status: string }>
): "pending" | "in_progress" | "completed" {
  return nextTrainingStatusFromLms({ stored, enrollments });
}

/** First assigned course to mark in progress when a volunteer opens the training portal. */
export function firstAssignedCourseId(
  enrollments: Array<{ course_id: string; status: string; required?: boolean }>
): string | null {
  const active = enrollments.filter((e) => e.status !== "removed");
  if (active.some((e) => e.status === "in_progress" || e.status === "completed")) return null;
  const assigned = active.filter((e) => e.status === "assigned");
  return assigned.find((e) => e.required)?.course_id ?? assigned[0]?.course_id ?? null;
}

export function deploymentReadyFromEnrollments(
  enrollments: Array<{ required: boolean; status: string }>
) {
  return requiredCoursesComplete(enrollments);
}

export function nextIncompleteModule<T extends { id: string; sort_order: number }>(
  modules: T[],
  completedIds: Set<string>
): T | null {
  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order);
  return sorted.find((m) => !completedIds.has(m.id)) ?? null;
}

export function estimateMinutesLeft(
  modules: Array<{ id: string; estimated_minutes?: number | null }>,
  completedIds: Set<string>
) {
  return modules
    .filter((m) => !completedIds.has(m.id))
    .reduce((sum, m) => sum + (m.estimated_minutes ?? 0), 0);
}

export function gradeQuiz(
  questions: Array<{ id: string; answer: number }>,
  answers: Record<string, number>
) {
  let correct = 0;
  for (const question of questions) {
    if (answers[question.id] === question.answer) correct += 1;
  }
  return {
    correct,
    total: questions.length,
    score: scorePercent(correct, questions.length),
  };
}

export function certificateCode(volunteerName: string, courseSlug: string, issuedAt: Date) {
  const stamp = issuedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const name = volunteerName.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "VOL";
  const slug = courseSlug.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "CRS";
  return `${name}-${slug}-${stamp}`;
}

export function formatDue(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-NG", { dateStyle: "medium" });
}

export function isOverdue(dueAt: string | null | undefined, status: string, now = new Date()) {
  if (!dueAt || status === "completed" || status === "removed") return false;
  const due = new Date(dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

/** Core briefing (null role) is assigned to everyone, including people who picked no support roles. */
export function publishedCoursesForRoles<T extends { status: string; role_slug: string | null }>(
  courses: T[],
  roles: string[]
) {
  return courses.filter(
    (course) =>
      course.status === "published" &&
      (course.role_slug == null || roles.includes(course.role_slug))
  );
}
