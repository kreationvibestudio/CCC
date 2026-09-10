import type { SupabaseClient } from "@supabase/supabase-js";
import { LMS_CATALOG } from "./catalog";

export type CourseRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  role_slug: string | null;
  estimated_minutes: number | null;
  status: string;
  pass_mark: number | null;
  max_attempts: number | null;
  is_required: boolean | null;
  sort_order: number | null;
};

export type ModuleRow = {
  id: string;
  tenant_id: string;
  course_id: string;
  slug: string;
  title: string;
  kind: string;
  body: string | null;
  resource_url: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  quiz: unknown;
};

export async function ensureLmsCatalog(supabase: SupabaseClient, tenantId: string) {
  for (const [index, course] of LMS_CATALOG.entries()) {
    const { error: courseError } = await supabase.from("lms_courses").upsert(
      {
        tenant_id: tenantId,
        slug: course.slug,
        title: course.title,
        description: course.description,
        role_slug: course.roleSlug,
        estimated_minutes: course.minutes,
        status: "published",
        pass_mark: 70,
        max_attempts: 3,
        is_required: true,
        sort_order: index,
      },
      { onConflict: "tenant_id,slug" }
    );
    if (courseError) throw new Error(courseError.message);
  }

  const { data: courses, error } = await supabase
    .from("lms_courses")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const bySlug = new Map((courses as CourseRow[] | null)?.map((c) => [c.slug, c]) ?? []);

  for (const course of LMS_CATALOG) {
    const row = bySlug.get(course.slug);
    if (!row) continue;
    for (const [moduleIndex, module] of course.modules.entries()) {
      const { error: moduleError } = await supabase.from("lms_modules").upsert(
        {
          tenant_id: tenantId,
          course_id: row.id,
          slug: module.slug,
          title: module.title,
          kind: module.kind,
          body: module.body ?? null,
          resource_url: module.resourceUrl ?? null,
          estimated_minutes: module.minutes,
          sort_order: moduleIndex,
          quiz: module.questions ? { questions: module.questions } : null,
        },
        { onConflict: "course_id,slug" }
      );
      if (moduleError) throw new Error(moduleError.message);
    }
  }

  return bySlug;
}

export async function publishedCourses(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("lms_courses")
    .select("*")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as CourseRow[] | null) ?? [];
}

export async function modulesForCourse(supabase: SupabaseClient, courseId: string) {
  const { data, error } = await supabase
    .from("lms_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as ModuleRow[] | null) ?? [];
}
