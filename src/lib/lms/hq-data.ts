import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { authorize } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/session";
import { ensureLmsCatalog, type CourseRow } from "./ensure-catalog";
import {
  enrollIfNeeded,
  enrollVolunteer,
  ensureTrainingCode,
  rolesForVolunteer,
} from "./enroll";
import { isOverdue, percentComplete } from "./progress";
import { parseSupportRoles, supportRoleLabel, VOLUNTEER_SUPPORT_ROLES } from "./roles";
import type { EnrollmentRow, ProgressRow } from "./complete";
import { LMS_CATALOG } from "./catalog";

function scopeSql(user: AuthUser) {
  return {
    ward: user.role === "ward_coordinator" ? user.profile.ward : null,
    lga: user.role === "ward_coordinator" ? user.profile.lga : null,
  };
}

async function viewGate() {
  const gate = await authorize("training.view");
  if (!gate.ok) return { error: gate.error as string };
  return { user: gate.user, supabase: await createClient() };
}

export async function bootstrapLms(tenantId: string, actorId?: string | null) {
  const admin = createServiceClient();
  await ensureLmsCatalog(admin, tenantId);
  const { data: volunteers } = await admin.from("volunteers").select("*").eq("tenant_id", tenantId);
  for (const volunteer of volunteers ?? []) {
    await ensureTrainingCode(admin, tenantId, volunteer.id, volunteer.training_code);
    const roles = rolesForVolunteer(volunteer);
    if (roles.length) {
      await enrollVolunteer(admin, {
        tenantId,
        volunteerId: volunteer.id,
        roles,
        actorId,
      });
    }
  }
}

export async function getTrainingOverview() {
  const gate = await viewGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const admin = createServiceClient();
  const tenantId = user.profile.tenant_id;
  try {
    await bootstrapLms(tenantId, user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load training catalog. Apply the LMS SQL in Supabase." };
  }
  const scope = scopeSql(user);
  let volunteerQuery = supabase.from("volunteers").select("*").eq("tenant_id", tenantId).order("full_name");
  if (scope.ward) volunteerQuery = volunteerQuery.eq("ward", scope.ward);
  else if (scope.lga) volunteerQuery = volunteerQuery.eq("lga", scope.lga);
  const [
    { data: volunteers },
    { data: enrollments, error: enrollmentError },
    { data: courses, error: courseError },
    { data: modules, error: moduleError },
    { data: certificates, error: certError },
    { data: sessions },
    { data: logs },
  ] = await Promise.all([
    volunteerQuery,
    admin.from("lms_enrollments").select("*").eq("tenant_id", tenantId),
    admin.from("lms_courses").select("*").eq("tenant_id", tenantId).order("sort_order"),
    admin.from("lms_modules").select("id, course_id, slug, title, kind, body, estimated_minutes, sort_order, quiz").eq("tenant_id", tenantId).order("sort_order"),
    admin.from("lms_certificates").select("*").eq("tenant_id", tenantId),
    admin.from("lms_live_sessions").select("*").eq("tenant_id", tenantId).order("starts_at", { ascending: false }).limit(20),
    admin.from("lms_activity_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(25),
  ]);
  if (courseError) return { error: courseError.message };
  if (moduleError) return { error: moduleError.message };
  if (enrollmentError) return { error: enrollmentError.message };
  if (certError) return { error: certError.message };
  if (!(courses ?? []).length) {
    return { error: "Training catalog is empty. Copy the training SQL and run it in Supabase, then refresh." };
  }

  const people = volunteers ?? [];
  const enrollmentRows = (enrollments ?? []) as EnrollmentRow[];
  const byVolunteer = new Map<string, EnrollmentRow[]>();
  for (const row of enrollmentRows) {
    const list = byVolunteer.get(row.volunteer_id) ?? [];
    list.push(row);
    byVolunteer.set(row.volunteer_id, list);
  }

  const trained = people.filter((v) => v.deployment_ready || v.training_status === "completed").length;
  const ready = people.filter((v) => v.deployment_ready).length;
  const overdue = people.filter((v) => {
    const rows = byVolunteer.get(v.id) ?? [];
    return rows.some((e) => isOverdue(e.due_at, e.status));
  });

  const byRole = VOLUNTEER_SUPPORT_ROLES.map((role) => {
    const members = people.filter((v) => (v.support_roles ?? []).includes(role.slug));
    const completed = members.filter((v) => v.deployment_ready).length;
    return { ...role, total: members.length, ready: completed, pct: percentComplete(completed, members.length) };
  });

  const byLga = new Map<string, { total: number; ready: number }>();
  for (const person of people) {
    const key = person.lga?.trim() || "Unspecified";
    const bucket = byLga.get(key) ?? { total: 0, ready: 0 };
    bucket.total += 1;
    if (person.deployment_ready) bucket.ready += 1;
    byLga.set(key, bucket);
  }

  return {
    volunteers: people,
    enrollments: enrollmentRows,
    courses: (courses ?? []) as CourseRow[],
    modules: (modules ?? []) as Array<{
      id: string;
      course_id: string;
      slug: string;
      title: string;
      kind: string;
      body: string | null;
      estimated_minutes: number | null;
      sort_order: number;
      quiz: { questions?: Array<{ id: string; prompt: string; choices: string[] }> } | null;
    }>,
    certificates: certificates ?? [],
    sessions: sessions ?? [],
    logs: logs ?? [],
    stats: {
      total: people.length,
      trained,
      ready,
      overdue: overdue.length,
      inProgress: people.filter((v) => v.training_status === "in_progress").length,
    },
    overdue,
    byRole,
    byLga: [...byLga.entries()].map(([lga, n]) => ({ lga, ...n, pct: percentComplete(n.ready, n.total) })),
    catalogSize: LMS_CATALOG.length,
  };
}

export async function getHqVolunteerLms(volunteerId: string) {
  const gate = await viewGate();
  if ("error" in gate) return { error: gate.error };
  const { user } = gate;
  const admin = createServiceClient();
  const tenantId = user.profile.tenant_id;
  try {
    await ensureLmsCatalog(admin, tenantId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load training catalog." };
  }
  const { data: volunteer } = await admin
    .from("volunteers")
    .select("*")
    .eq("id", volunteerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!volunteer) return { error: "Volunteer not found." };
  await enrollIfNeeded(admin, volunteer, user.id);
  const [{ data: enrollments }, { data: courses }, { data: progress }, { data: certs }, { data: attempts }] =
    await Promise.all([
      admin.from("lms_enrollments").select("*").eq("volunteer_id", volunteerId).neq("status", "removed"),
      admin.from("lms_courses").select("*").eq("tenant_id", tenantId),
      admin.from("lms_module_progress").select("*").eq("volunteer_id", volunteerId),
      admin.from("lms_certificates").select("*").eq("volunteer_id", volunteerId),
      admin.from("lms_quiz_attempts").select("*").eq("volunteer_id", volunteerId).order("created_at", { ascending: false }).limit(20),
    ]);
  const courseMap = new Map(((courses ?? []) as CourseRow[]).map((c) => [c.id, c]));
  return {
    volunteer,
    enrollments: ((enrollments ?? []) as EnrollmentRow[]).map((e) => ({ ...e, course: courseMap.get(e.course_id) })),
    progress: (progress ?? []) as ProgressRow[],
    certificates: certs ?? [],
    attempts: attempts ?? [],
    courses: (courses ?? []) as CourseRow[],
    roleLabels: parseSupportRoles(volunteer.support_roles).map((slug) => supportRoleLabel(slug)),
  };
}

export async function getSessionAttendees(sessionId: string) {
  const gate = await viewGate();
  if ("error" in gate) return [];
  const { supabase, user } = gate;
  const { data } = await supabase
    .from("lms_session_attendees")
    .select("id, status, volunteer_id, volunteers(full_name, phone, lga, ward)")
    .eq("session_id", sessionId)
    .eq("tenant_id", user.profile.tenant_id);
  return data ?? [];
}

export async function getEligibleVolunteers(input?: { roleSlug?: string | null; requireReady?: boolean }) {
  const gate = await viewGate();
  if ("error" in gate) return [];
  const overview = await getTrainingOverview();
  if ("error" in overview) return [];
  return overview.volunteers.filter((v) => {
    if (input?.requireReady !== false && !v.deployment_ready) return false;
    if (input?.roleSlug && !(v.support_roles ?? []).includes(input.roleSlug)) return false;
    return true;
  });
}

