import "server-only";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { LEARN_COOKIE, readLearnToken } from "./codes";
import { ensureLmsCatalog, type CourseRow, type ModuleRow } from "./ensure-catalog";
import type { EnrollmentRow, ProgressRow } from "./complete";
import { enrollIfNeeded, ensureTrainingCode, syncVolunteerReadiness } from "./enroll";
import { supportRoleLabel } from "./roles";

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

export async function requireLearner() {
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
  try {
    await syncVolunteerReadiness(admin, volunteer.tenant_id, volunteer.id);
  } catch {
    // Dashboard still loads if HQ status sync is unavailable.
  }
  const { data: refreshed } = await admin
    .from("volunteers")
    .select("*")
    .eq("id", volunteer.id)
    .maybeSingle();
  const current = (refreshed as LearnVolunteer | null) ?? volunteer;

  const [{ data: enrollments }, { data: courses }, { data: certs }, { data: sessions }, { data: reminders }] =
    await Promise.all([
      admin.from("lms_enrollments").select("*").eq("volunteer_id", current.id).neq("status", "removed"),
      admin.from("lms_courses").select("*").eq("tenant_id", current.tenant_id).eq("status", "published"),
      admin.from("lms_certificates").select("*").eq("volunteer_id", current.id),
      admin
        .from("lms_live_sessions")
        .select("*")
        .eq("tenant_id", current.tenant_id)
        .gte("starts_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("starts_at")
        .limit(8),
      admin
        .from("lms_activity_logs")
        .select("*")
        .eq("volunteer_id", current.id)
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
  const { data: progress } = await admin.from("lms_module_progress").select("*").eq("volunteer_id", current.id);
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
    .eq("volunteer_id", current.id);

  return {
    volunteer: current,
    campaign,
    roles: (current.support_roles ?? []).map((slug) => ({ slug, label: supportRoleLabel(slug) })),
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
