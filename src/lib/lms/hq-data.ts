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
  syncVolunteerReadiness,
} from "./enroll";
import { generateTrainingCode } from "./codes";
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
  const gate = await authorize("volunteers.view");
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
  await seedDemoProgress(admin, tenantId, volunteers ?? []);
}

async function seedDemoProgress(
  admin: ReturnType<typeof createServiceClient>,
  tenantId: string,
  volunteers: Array<Record<string, unknown>>
) {
  const { count } = await admin
    .from("lms_quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0 || volunteers.length === 0) return;

  const { data: courses } = await admin.from("lms_courses").select("*").eq("tenant_id", tenantId);
  const core = (courses as CourseRow[] | null)?.find((c) => c.slug === "core-campaign-briefing");
  if (!core) return;
  const { data: modules } = await admin.from("lms_modules").select("*").eq("course_id", core.id);
  const demoRoles = ["field_canvassing", "phone_banking", "event_support", "polling_day"] as const;

  for (const [index, volunteer] of volunteers.entries()) {
    const role = demoRoles[index % demoRoles.length];
    const existing = parseSupportRoles(volunteer.support_roles);
    if (!existing.length) {
      await admin
        .from("volunteers")
        .update({ support_roles: [role] })
        .eq("id", volunteer.id);
      await enrollVolunteer(admin, {
        tenantId,
        volunteerId: volunteer.id as string,
        roles: [role],
      });
    }
    if (!volunteer.training_code) {
      await admin
        .from("volunteers")
        .update({ training_code: generateTrainingCode() })
        .eq("id", volunteer.id)
        .is("training_code", null);
    }

    const finishCore = index % 3 !== 1;
    if (finishCore && modules?.length) {
      for (const courseModule of modules) {
        await admin.from("lms_module_progress").upsert(
          {
            tenant_id: tenantId,
            volunteer_id: volunteer.id,
            module_id: courseModule.id,
            status: "completed",
            score: courseModule.kind === "quiz" ? 100 : null,
            attempts: courseModule.kind === "quiz" ? 1 : 0,
            completed_at: new Date().toISOString(),
            acknowledgement: courseModule.kind === "acknowledgement" ? "I agree" : null,
            assignment_notes: courseModule.kind === "assignment" ? "Ready to apply this in my ward." : null,
          },
          { onConflict: "volunteer_id,module_id" }
        );
        if (courseModule.kind === "quiz") {
          await admin.from("lms_quiz_attempts").insert({
            tenant_id: tenantId,
            volunteer_id: volunteer.id,
            module_id: courseModule.id,
            score: 100,
            passed: true,
            answers: {},
          });
        }
      }
      await admin
        .from("lms_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("volunteer_id", volunteer.id)
        .eq("course_id", core.id);
      await admin.from("lms_certificates").upsert(
        {
          tenant_id: tenantId,
          volunteer_id: volunteer.id,
          course_id: core.id,
          code: `DEMO-CORE-${String(volunteer.id).slice(0, 4).toUpperCase()}`,
          issued_at: new Date().toISOString(),
        },
        { onConflict: "volunteer_id,course_id" }
      );
    }
    await syncVolunteerReadiness(admin, tenantId, volunteer.id as string);
  }

  const { count: sessionCount } = await admin
    .from("lms_live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((sessionCount ?? 0) === 0) {
    const starts = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    starts.setHours(10, 0, 0, 0);
    await admin.from("lms_live_sessions").insert({
      tenant_id: tenantId,
      course_id: core.id,
      title: "Ward briefing — core conduct",
      description: "Live walkthrough of campaign values, safety, and how to log your first shift.",
      starts_at: starts.toISOString(),
      location: "Campaign HQ, Uromi",
      meeting_url: "https://meet.google.com/ccc-ward-briefing",
      capacity: 40,
      follow_up: "Bring a notebook. Download the field conduct card before you arrive.",
    });
  }
}

export async function getTrainingOverview() {
  const gate = await viewGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  try {
    await bootstrapLms(user.profile.tenant_id, user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load training catalog. Apply the LMS SQL in Supabase." };
  }
  const scope = scopeSql(user);
  let volunteerQuery = supabase.from("volunteers").select("*").eq("tenant_id", user.profile.tenant_id).order("full_name");
  if (scope.ward) volunteerQuery = volunteerQuery.eq("ward", scope.ward);
  else if (scope.lga) volunteerQuery = volunteerQuery.eq("lga", scope.lga);
  const [{ data: volunteers }, { data: enrollments }, { data: courses }, { data: sessions }, { data: logs }] =
    await Promise.all([
      volunteerQuery,
      supabase.from("lms_enrollments").select("*").eq("tenant_id", user.profile.tenant_id),
      supabase.from("lms_courses").select("*").eq("tenant_id", user.profile.tenant_id).order("sort_order"),
      supabase.from("lms_live_sessions").select("*").eq("tenant_id", user.profile.tenant_id).order("starts_at", { ascending: false }).limit(20),
      supabase.from("lms_activity_logs").select("*").eq("tenant_id", user.profile.tenant_id).order("created_at", { ascending: false }).limit(25),
    ]);

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
  const { user, supabase } = gate;
  await ensureLmsCatalog(supabase, user.profile.tenant_id);
  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", volunteerId)
    .eq("tenant_id", user.profile.tenant_id)
    .maybeSingle();
  if (!volunteer) return { error: "Volunteer not found." };
  await enrollIfNeeded(supabase, volunteer, user.id);
  const [{ data: enrollments }, { data: courses }, { data: progress }, { data: certs }, { data: attempts }] =
    await Promise.all([
      supabase.from("lms_enrollments").select("*").eq("volunteer_id", volunteerId).neq("status", "removed"),
      supabase.from("lms_courses").select("*").eq("tenant_id", user.profile.tenant_id),
      supabase.from("lms_module_progress").select("*").eq("volunteer_id", volunteerId),
      supabase.from("lms_certificates").select("*").eq("volunteer_id", volunteerId),
      supabase.from("lms_quiz_attempts").select("*").eq("volunteer_id", volunteerId).order("created_at", { ascending: false }).limit(20),
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

