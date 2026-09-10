import type { SupabaseClient } from "@supabase/supabase-js";
import { certificateCode } from "./progress";
import { syncVolunteerReadiness, logLmsActivity } from "./enroll";
import type { CourseRow, ModuleRow } from "./ensure-catalog";
import { modulesForCourse } from "./ensure-catalog";

export type EnrollmentRow = {
  id: string;
  tenant_id: string;
  volunteer_id: string;
  course_id: string;
  status: string;
  required: boolean;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ProgressRow = {
  module_id: string;
  status: string;
  score: number | null;
  attempts: number | null;
  completed_at: string | null;
  acknowledgement: string | null;
  assignment_notes: string | null;
};

export async function issueCertificate(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId: string;
    volunteerName: string;
    course: CourseRow;
  }
) {
  const code = certificateCode(input.volunteerName, input.course.slug, new Date());
  const { error } = await supabase.from("lms_certificates").upsert(
    {
      tenant_id: input.tenantId,
      volunteer_id: input.volunteerId,
      course_id: input.course.id,
      code,
      issued_at: new Date().toISOString(),
    },
    { onConflict: "volunteer_id,course_id" }
  );
  if (error) throw new Error(error.message);
  await logLmsActivity(supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    action: "training.certificate_issued",
    detail: `Certificate issued for ${input.course.title}`,
    metadata: { course_id: input.course.id, code },
  });
  return code;
}

export async function completeCourseIfReady(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId: string;
    volunteerName: string;
    course: CourseRow;
  }
) {
  const modules = await modulesForCourse(supabase, input.course.id);
  const { data: progress } = await supabase
    .from("lms_module_progress")
    .select("module_id, status")
    .eq("volunteer_id", input.volunteerId)
    .eq("tenant_id", input.tenantId);
  const done = new Set(
    ((progress ?? []) as ProgressRow[])
      .filter((p) => p.status === "completed")
      .map((p) => p.module_id)
  );
  if (modules.length === 0 || modules.some((m) => !done.has(m.id))) return false;

  await supabase
    .from("lms_enrollments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("volunteer_id", input.volunteerId)
    .eq("course_id", input.course.id)
    .neq("status", "removed");

  await issueCertificate(supabase, input);
  await logLmsActivity(supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    action: "training.course_completed",
    detail: `Completed ${input.course.title}`,
    metadata: { course_id: input.course.id },
  });
  await syncVolunteerReadiness(supabase, input.tenantId, input.volunteerId);
  return true;
}

export async function markEnrollmentStarted(
  supabase: SupabaseClient,
  tenantId: string,
  volunteerId: string,
  courseId: string
) {
  await supabase
    .from("lms_enrollments")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("volunteer_id", volunteerId)
    .eq("course_id", courseId)
    .in("status", ["assigned"]);
}

export async function upsertProgress(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    volunteerId: string;
    module: ModuleRow;
    status: "incomplete" | "completed";
    score?: number | null;
    attempts?: number;
    acknowledgement?: string | null;
    assignmentNotes?: string | null;
  }
) {
  const patch = {
    tenant_id: input.tenantId,
    volunteer_id: input.volunteerId,
    module_id: input.module.id,
    status: input.status,
    score: input.score ?? null,
    attempts: input.attempts ?? 0,
    completed_at: input.status === "completed" ? new Date().toISOString() : null,
    acknowledgement: input.acknowledgement ?? null,
    assignment_notes: input.assignmentNotes ?? null,
  };
  const { error } = await supabase
    .from("lms_module_progress")
    .upsert(patch, { onConflict: "volunteer_id,module_id" });
  if (error) return { error: error.message };
  return { success: true as const };
}
