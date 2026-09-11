"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { LEARN_COOKIE, normalizeTrainingCode, signLearnToken } from "./codes";
import { ensureLmsCatalog, type CourseRow, type ModuleRow } from "./ensure-catalog";
import {
  completeCourseIfReady,
  markAssignedTrainingStarted,
  markEnrollmentStarted,
  resetCourseProgressForRetake,
  upsertProgress,
} from "./complete";
import { enrollIfNeeded, logLmsActivity, syncVolunteerReadiness } from "./enroll";
import { canRetryQuiz, gradeQuiz, quizPassed } from "./progress";
import { phoneLookupValues } from "./phone";
import { requireLearner, type LearnVolunteer } from "./learn-data";

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
    try {
      await markAssignedTrainingStarted(admin, campaign.id, volunteer.id);
      await logLmsActivity(admin, {
        tenantId: campaign.id,
        volunteerId: volunteer.id,
        action: "training.login",
        detail: "Signed in to Volunteer Training",
      });
    } catch {
      // Login still succeeds if HQ status sync is unavailable.
    }
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

export async function retakeLearnCourse(courseId: string): Promise<{ error?: string; success?: true }> {
  try {
    const gate = await requireLearner();
    if (!gate.ok) return { error: gate.error };
    const { volunteer, admin } = gate;
    if (!courseId.trim()) return { error: "Choose a course to retake." };
    return resetCourseProgressForRetake(admin, {
      tenantId: volunteer.tenant_id,
      volunteerId: volunteer.id,
      courseId,
    });
  } catch (error) {
    return failed(error, "Could not reset this course. Try again.");
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
