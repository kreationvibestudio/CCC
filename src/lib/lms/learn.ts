"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { LEARN_COOKIE, normalizeTrainingCode, readLearnToken, signLearnToken } from "./codes";
import { ensureLmsCatalog, type CourseRow, type ModuleRow } from "./ensure-catalog";
import {
  completeCourseIfReady,
  markEnrollmentStarted,
  upsertProgress,
  type EnrollmentRow,
  type ProgressRow,
} from "./complete";
import { enrollIfNeeded, ensureTrainingCode, logLmsActivity, syncVolunteerReadiness } from "./enroll";
import { canRetryQuiz, gradeQuiz, quizPassed } from "./progress";
import { supportRoleLabel } from "./roles";
import { phoneLookupValues } from "./phone";

function failed(error: unknown, fallback: string): { error: string } {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;
  return { error: message };
}

type QuizSubmitResult =
  | { error: string }
  | {
      success: true;
      score: number;
      passed: boolean;
      passMark: number;
      attempts: number;
      maxAttempts: number;
      courseCompleted: boolean;
      courseId: string;
      alreadyPassed?: boolean;
    };

type ModuleCompleteResult =
  | { error: string }
  | { success: true; courseCompleted: boolean; courseId: string };

export type LearnVolunteer = {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  ward?: string | null;
  lga?: string | null;
  support_roles?: string[] | null;
  skills?: string[] | null;
  training_code?: string | null;
  training_status: string;
  deployment_ready?: boolean | null;
  trained_at?: string | null;
};

export async function getLearnSession(): Promise<{ volunteer: LearnVolunteer; campaign: string } | null> {
  try {
    const token = (await cookies()).get(LEARN_COOKIE)?.value;
    const parsed = readLearnToken(token);
    if (!parsed) return null;
    const admin = createServiceClient();
    const { data: volunteer } = await admin
      .from("volunteers")
      .select("*")
      .eq("id", parsed.volunteerId)
      .eq("tenant_id", parsed.tenantId)
      .maybeSingle();
    if (!volunteer) return null;
    const { data: tenant } = await admin.from("tenants").select("name").eq("id", parsed.tenantId).maybeSingle();
    return { volunteer: volunteer as LearnVolunteer, campaign: tenant?.name ?? "the campaign" };
  } catch {
    return null;
  }
}

export async function loginVolunteerLearn(input: {
  slug: string;
  phone: string;
  code: string;
}): Promise<{ error?: string; success?: true }> {
  try {
    const ip = clientIp(await headers());
    const verdict = await checkRateLimit("volunteerSignup", `learn:${input.slug}:${ip}`);
    if (!verdict.allowed) return { error: "Too many login attempts. Try again later." };

    const phones = phoneLookupValues(input.phone);
    const code = normalizeTrainingCode(input.code);
    if (!phones.some((value) => value.replace(/\D/g, "").length >= 10)) {
      return { error: "Enter the phone number you registered with." };
    }
    if (code.length < 6) return { error: "Enter your training code." };

    const admin = createServiceClient();
    const { data: campaign } = await admin
      .from("tenants")
      .select("id, name, slug")
      .eq("slug", input.slug.trim().toLowerCase())
      .maybeSingle();
    if (!campaign?.id) return { error: "This training link is invalid." };

    const { data: volunteer } = await admin
      .from("volunteers")
      .select("*")
      .eq("tenant_id", campaign.id)
      .in("phone", phones)
      .maybeSingle();
    if (!volunteer?.training_code) return { error: "We could not find training access for that phone number." };
    if (normalizeTrainingCode(volunteer.training_code) !== code) {
      return { error: "That training code does not match this phone number." };
    }

    await ensureLmsCatalog(admin, campaign.id);
    await enrollIfNeeded(admin, volunteer as LearnVolunteer);
    const token = signLearnToken(volunteer.id, campaign.id);
    (await cookies()).set(LEARN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    return { success: true };
  } catch (error) {
    return failed(error, "Could not open training. Try again.");
  }
}

export async function logoutVolunteerLearn() {
  (await cookies()).delete(LEARN_COOKIE);
}

async function requireLearner() {
  const session = await getLearnSession();
  if (!session) return { ok: false as const, error: "Please sign in to continue training." };
  return {
    ok: true as const,
    volunteer: session.volunteer,
    campaign: session.campaign,
    admin: createServiceClient(),
  };
}

export async function getLearnDashboard() {
  const gate = await requireLearner();
  if (!gate.ok) return { error: gate.error };
  const { volunteer, campaign, admin } = gate;
  await ensureLmsCatalog(admin, volunteer.tenant_id);
  await enrollIfNeeded(admin, volunteer);
  await ensureTrainingCode(admin, volunteer.tenant_id, volunteer.id, volunteer.training_code);

  const [{ data: enrollments }, { data: courses }, { data: certs }, { data: sessions }, { data: reminders }] =
    await Promise.all([
      admin.from("lms_enrollments").select("*").eq("volunteer_id", volunteer.id).neq("status", "removed"),
      admin.from("lms_courses").select("*").eq("tenant_id", volunteer.tenant_id).eq("status", "published"),
      admin.from("lms_certificates").select("*").eq("volunteer_id", volunteer.id),
      admin
        .from("lms_live_sessions")
        .select("*")
        .eq("tenant_id", volunteer.tenant_id)
        .gte("starts_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("starts_at")
        .limit(8),
      admin
        .from("lms_activity_logs")
        .select("*")
        .eq("volunteer_id", volunteer.id)
        .eq("action", "training.reminder")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const courseMap = new Map(((courses ?? []) as CourseRow[]).map((c) => [c.id, c]));
  const enrollmentRows = (enrollments ?? []) as EnrollmentRow[];
  const courseIds = enrollmentRows.map((e) => e.course_id);
  const { data: modules } = courseIds.length
    ? await admin.from("lms_modules").select("*").in("course_id", courseIds).order("sort_order")
    : { data: [] };
  const { data: progress } = await admin
    .from("lms_module_progress")
    .select("*")
    .eq("volunteer_id", volunteer.id);
  const progressRows = (progress ?? []) as ProgressRow[];
  const done = new Set(progressRows.filter((p) => p.status === "completed").map((p) => p.module_id));

  const paths = enrollmentRows.map((enrollment) => {
    const course = courseMap.get(enrollment.course_id);
    const courseModules = ((modules ?? []) as ModuleRow[]).filter((m) => m.course_id === enrollment.course_id);
    const completed = courseModules.filter((m) => done.has(m.id)).length;
    return {
      enrollment,
      course,
      modules: courseModules,
      completed,
      total: courseModules.length,
    };
  });

  const { data: rsvps } = await admin
    .from("lms_session_attendees")
    .select("session_id, status")
    .eq("volunteer_id", volunteer.id);

  return {
    volunteer,
    campaign,
    roles: (volunteer.support_roles ?? []).map((slug) => ({ slug, label: supportRoleLabel(slug) })),
    paths,
    certificates: certs ?? [],
    sessions: sessions ?? [],
    rsvps: rsvps ?? [],
    reminders: reminders ?? [],
    progress: progressRows,
  };
}

export async function getLearnCourse(courseId: string) {
  const dash = await getLearnDashboard();
  if ("error" in dash) return { error: dash.error };
  const path = dash.paths.find((p) => p.course?.id === courseId);
  if (!path?.course) return { error: "This course is not on your learning path." };
  return path;
}

export async function completeLearnModule(input: {
  moduleId: string;
  acknowledgement?: string;
  assignmentNotes?: string;
}): Promise<ModuleCompleteResult> {
  try {
    const gate = await requireLearner();
    if (!gate.ok) return { error: gate.error };
    const { volunteer, admin } = gate;
    const { data: courseModule } = await admin.from("lms_modules").select("*").eq("id", input.moduleId).maybeSingle();
    if (!courseModule) return { error: "Module not found." };
    const row = courseModule as ModuleRow;
    if (row.kind === "quiz") return { error: "Submit the quiz to complete this module." };
    if (row.kind === "acknowledgement" && !input.acknowledgement?.trim()) {
      return { error: "Please acknowledge to continue." };
    }
    if (row.kind === "assignment" && !(input.assignmentNotes ?? "").trim()) {
      return { error: "Add a short practice note to continue." };
    }

    const { data: course } = await admin.from("lms_courses").select("*").eq("id", row.course_id).maybeSingle();
    if (!course) return { error: "Course not found." };
    await markEnrollmentStarted(admin, volunteer.tenant_id, volunteer.id, row.course_id);
    const saved = await upsertProgress(admin, {
      tenantId: volunteer.tenant_id,
      volunteerId: volunteer.id,
      module: row,
      status: "completed",
      acknowledgement: input.acknowledgement ?? null,
      assignmentNotes: input.assignmentNotes ?? null,
    });
    if ("error" in saved && saved.error) return saved;
    const courseCompleted = await completeCourseIfReady(admin, {
      tenantId: volunteer.tenant_id,
      volunteerId: volunteer.id,
      volunteerName: volunteer.full_name,
      course: course as CourseRow,
    });
    await syncVolunteerReadiness(admin, volunteer.tenant_id, volunteer.id);
    return { success: true as const, courseCompleted, courseId: row.course_id };
  } catch (error) {
    return failed(error, "Could not save this module. Try again.");
  }
}

export async function submitLearnQuiz(input: { moduleId: string; answers: Record<string, number> }): Promise<QuizSubmitResult> {
  try {
    const gate = await requireLearner();
    if (!gate.ok) return { error: gate.error };
    const { volunteer, admin } = gate;
    const { data: courseModule } = await admin.from("lms_modules").select("*").eq("id", input.moduleId).maybeSingle();
    if (!courseModule) return { error: "Quiz not found." };
    const row = courseModule as ModuleRow;
    const { data: course } = await admin.from("lms_courses").select("*").eq("id", row.course_id).maybeSingle();
    if (!course) return { error: "Course not found." };
    const questions = ((row.quiz as { questions?: Array<{ id: string; answer: number }> } | null)?.questions) ?? [];
    const { data: existing } = await admin
      .from("lms_module_progress")
      .select("attempts, status, score")
      .eq("volunteer_id", volunteer.id)
      .eq("module_id", row.id)
      .maybeSingle();
    const attempts = Number(existing?.attempts ?? 0);
    const maxAttempts = Number((course as CourseRow).max_attempts ?? 3);
    const passMark = Number((course as CourseRow).pass_mark ?? 70);

    async function finishCourse(passed: boolean) {
      if (!passed) return false;
      await markEnrollmentStarted(admin, volunteer.tenant_id, volunteer.id, row.course_id);
      const courseCompleted = await completeCourseIfReady(admin, {
        tenantId: volunteer.tenant_id,
        volunteerId: volunteer.id,
        volunteerName: volunteer.full_name,
        course: course as CourseRow,
      });
      await syncVolunteerReadiness(admin, volunteer.tenant_id, volunteer.id);
      return courseCompleted;
    }

    if (existing?.status === "completed") {
      const courseCompleted = await finishCourse(true);
      return {
        success: true as const,
        score: Number(existing.score ?? 100),
        passed: true,
        passMark,
        attempts,
        maxAttempts,
        courseCompleted,
        courseId: row.course_id,
        alreadyPassed: true,
      };
    }
    if (!canRetryQuiz(attempts, maxAttempts)) {
      return { error: `No retries left (${maxAttempts} attempts). Ask HQ for help.` };
    }

    const graded = gradeQuiz(questions, input.answers);
    const passed = quizPassed(graded.score, passMark);
    const nextAttempts = attempts + 1;
    const { error: attemptError } = await admin.from("lms_quiz_attempts").insert({
      tenant_id: volunteer.tenant_id,
      volunteer_id: volunteer.id,
      module_id: row.id,
      score: graded.score,
      passed,
      answers: input.answers,
    });
    if (attemptError) return { error: attemptError.message };
    await logLmsActivity(admin, {
      tenantId: volunteer.tenant_id,
      volunteerId: volunteer.id,
      action: "training.quiz_attempt",
      detail: passed ? `Passed quiz (${graded.score}%)` : `Quiz score ${graded.score}%`,
      metadata: { module_id: row.id, score: graded.score, passed, attempt: nextAttempts },
    });
    const saved = await upsertProgress(admin, {
      tenantId: volunteer.tenant_id,
      volunteerId: volunteer.id,
      module: row,
      status: passed ? "completed" : "incomplete",
      score: graded.score,
      attempts: nextAttempts,
    });
    if ("error" in saved && saved.error) return saved;
    const courseCompleted = await finishCourse(passed);
    return {
      success: true as const,
      score: graded.score,
      passed,
      passMark,
      attempts: nextAttempts,
      maxAttempts,
      courseCompleted,
      courseId: row.course_id,
    };
  } catch (error) {
    return failed(error, "Could not submit the quiz. Try again.");
  }
}

export async function rsvpLearnSession(sessionId: string) {
  try {
    const gate = await requireLearner();
    if (!gate.ok) return { error: gate.error };
    const { volunteer, admin } = gate;
    const { data: session } = await admin.from("lms_live_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) return { error: "Session not found." };
    if (session.capacity) {
      const { count } = await admin
        .from("lms_session_attendees")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if ((count ?? 0) >= session.capacity) return { error: "This session is full." };
    }
    const { error } = await admin.from("lms_session_attendees").upsert(
      {
        tenant_id: volunteer.tenant_id,
        session_id: sessionId,
        volunteer_id: volunteer.id,
        status: "registered",
      },
      { onConflict: "session_id,volunteer_id" }
    );
    if (error) return { error: error.message };
    return { success: true as const };
  } catch (error) {
    return failed(error, "Could not register for this session.");
  }
}

export async function getLearnCertificate(courseId: string) {
  const dash = await getLearnDashboard();
  if ("error" in dash) return { error: dash.error };
  const cert = (dash.certificates as Array<{ course_id: string; code: string; issued_at: string }>).find(
    (c) => c.course_id === courseId
  );
  const course = dash.paths.find((p) => p.course?.id === courseId)?.course;
  if (!cert || !course) return { error: "Certificate is not ready yet." };
  return { volunteer: dash.volunteer, campaign: dash.campaign, course, cert };
}
