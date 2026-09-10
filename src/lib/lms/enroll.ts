import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTrainingTransition } from "@/lib/volunteers/training";
import { generateTrainingCode } from "./codes";
import type { CourseRow } from "./ensure-catalog";
import { ensureLmsCatalog, publishedCourses } from "./ensure-catalog";
import { deploymentReadyFromEnrollments } from "./progress";
import { inferSupportRoles, parseSupportRoles, type SupportRoleSlug } from "./roles";

export async function ensureTrainingCode(
  supabase: SupabaseClient,
  tenantId: string,
  volunteerId: string,
  existing: string | null | undefined
) {
  if (existing) return existing;
  for (let i = 0; i < 6; i++) {
    const code = generateTrainingCode();
    const { error } = await supabase
      .from("volunteers")
      .update({ training_code: code })
      .eq("id", volunteerId)
      .eq("tenant_id", tenantId)
      .is("training_code", null);
    if (!error) {
      const { data } = await supabase
        .from("volunteers")
        .select("training_code")
        .eq("id", volunteerId)
        .maybeSingle();
      if (data?.training_code) return data.training_code as string;
    }
  }
  return generateTrainingCode();
}

export async function logLmsActivity(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId?: string | null;
    actorId?: string | null;
    action: string;
    detail?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("lms_activity_logs").insert({
    tenant_id: input.tenantId,
    volunteer_id: input.volunteerId ?? null,
    actor_id: input.actorId ?? null,
    action: input.action,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  });
  try {
    await supabase.from("activities").insert({
      tenant_id: input.tenantId,
      action: input.action,
      description: input.detail ?? input.action,
      metadata: { volunteer_id: input.volunteerId ?? null, ...(input.metadata ?? {}) },
    });
  } catch {
    // activities insert is best-effort
  }
}

export async function enrollVolunteer(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId: string;
    roles: SupportRoleSlug[];
    actorId?: string | null;
    dueDays?: number;
  }
) {
  await ensureLmsCatalog(supabase, input.tenantId);
  const courses = await publishedCourses(supabase, input.tenantId);
  const wanted = courses.filter(
    (c) => c.status === "published" && (c.role_slug == null || input.roles.includes(c.role_slug as SupportRoleSlug))
  );
  const dueAt =
    input.dueDays != null
      ? new Date(Date.now() + input.dueDays * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  for (const course of wanted) {
    await supabase.from("lms_enrollments").upsert(
      {
        tenant_id: input.tenantId,
        volunteer_id: input.volunteerId,
        course_id: course.id,
        status: "assigned",
        required: course.is_required !== false,
        due_at: dueAt,
        assigned_by: input.actorId ?? null,
      },
      { onConflict: "volunteer_id,course_id", ignoreDuplicates: true }
    );
  }

  await logLmsActivity(supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    actorId: input.actorId,
    action: "training.enrolled",
    detail: `Assigned ${wanted.length} course(s) for selected roles`,
    metadata: { roles: input.roles, course_ids: wanted.map((c) => c.id) },
  });

  return wanted;
}

export async function extraEnrollCourse(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId: string;
    courseId: string;
    actorId?: string | null;
    required?: boolean;
  }
) {
  const { error } = await supabase.from("lms_enrollments").upsert(
    {
      tenant_id: input.tenantId,
      volunteer_id: input.volunteerId,
      course_id: input.courseId,
      status: "assigned",
      required: input.required ?? false,
      due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      assigned_by: input.actorId ?? null,
    },
    { onConflict: "volunteer_id,course_id" }
  );
  if (error) return { error: error.message };
  await supabase
    .from("lms_enrollments")
    .update({ status: "assigned", required: input.required ?? false })
    .eq("volunteer_id", input.volunteerId)
    .eq("course_id", input.courseId)
    .eq("status", "removed");
  await logLmsActivity(supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    actorId: input.actorId,
    action: "training.course_assigned",
    detail: "Administrator assigned a course",
    metadata: { course_id: input.courseId },
  });
  return { success: true as const };
}

export async function removeEnrollment(
  supabase: SupabaseClient,
  input: { tenantId: string; volunteerId: string; courseId: string; actorId?: string | null }
) {
  const { error } = await supabase
    .from("lms_enrollments")
    .update({ status: "removed" })
    .eq("tenant_id", input.tenantId)
    .eq("volunteer_id", input.volunteerId)
    .eq("course_id", input.courseId);
  if (error) return { error: error.message };
  await logLmsActivity(supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    actorId: input.actorId,
    action: "training.course_removed",
    detail: "Administrator removed a course",
    metadata: { course_id: input.courseId },
  });
  await syncVolunteerReadiness(supabase, input.tenantId, input.volunteerId);
  return { success: true as const };
}

export async function syncVolunteerReadiness(
  supabase: SupabaseClient,
  tenantId: string,
  volunteerId: string
) {
  const { data: enrollments } = await supabase
    .from("lms_enrollments")
    .select("required, status")
    .eq("tenant_id", tenantId)
    .eq("volunteer_id", volunteerId);
  const rows = (enrollments ?? []) as Array<{ required: boolean; status: string }>;
  const active = rows.filter((e) => e.status !== "removed");
  const ready = deploymentReadyFromEnrollments(active);
  const started = active.some((e) => e.status === "in_progress" || e.status === "completed");
  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("training_status, trained_at")
    .eq("id", volunteerId)
    .maybeSingle();

  const nextStatus = ready ? "completed" : started ? "in_progress" : "pending";
  const training = applyTrainingTransition({
    next: nextStatus,
    existingTrainedAt: volunteer?.trained_at ?? null,
  });
  await supabase
    .from("volunteers")
    .update({
      ...training,
      deployment_ready: ready,
    })
    .eq("id", volunteerId)
    .eq("tenant_id", tenantId);
  return { ready, status: nextStatus };
}

export function rolesForVolunteer(volunteer: {
  support_roles?: string[] | null;
  skills?: string[] | null;
}): SupportRoleSlug[] {
  const selected = parseSupportRoles(volunteer.support_roles);
  if (selected.length) return selected;
  return inferSupportRoles(volunteer.skills);
}

export async function enrollIfNeeded(
  supabase: SupabaseClient,
  volunteer: {
    id: string;
    tenant_id: string;
    support_roles?: string[] | null;
    skills?: string[] | null;
  },
  actorId?: string | null
) {
  const roles = rolesForVolunteer(volunteer);
  if (!roles.length) return [];
  return enrollVolunteer(supabase, {
    tenantId: volunteer.tenant_id,
    volunteerId: volunteer.id,
    roles,
    actorId,
  });
}

export function courseForRole(courses: CourseRow[], role: string | null) {
  if (!role) return courses.find((c) => !c.role_slug);
  return courses.find((c) => c.role_slug === role);
}
