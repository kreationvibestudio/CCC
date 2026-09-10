import type { SupabaseClient } from "@supabase/supabase-js";
import { LMS_CATALOG } from "./catalog";
import { catalogCoverageComplete as coverageMatches } from "./catalog-coverage";

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

export function catalogCoverageComplete(
  courses: Array<{ id: string; slug: string }>,
  modules: Array<{ course_id: string; slug: string }>
) {
  return coverageMatches(LMS_CATALOG, courses, modules);
}

function missingCatalogCourses(existingSlugs: Set<string>) {
  return LMS_CATALOG.filter((course) => !existingSlugs.has(course.slug));
}

function missingCatalogModules(
  coursesBySlug: Map<string, { id: string }>,
  modulesByCourse: Map<string, Set<string>>
) {
  const rows: Array<{
    courseId: string;
    slug: string;
    title: string;
    kind: string;
    body: string | null;
    resourceUrl: string | null;
    minutes: number;
    sortOrder: number;
    quiz: { questions: unknown } | null;
  }> = [];
  for (const course of LMS_CATALOG) {
    const row = coursesBySlug.get(course.slug);
    if (!row) continue;
    const slugs = modulesByCourse.get(row.id) ?? new Set<string>();
    for (const [unitIndex, unit] of course.modules.entries()) {
      if (slugs.has(unit.slug)) continue;
      rows.push({
        courseId: row.id,
        slug: unit.slug,
        title: unit.title,
        kind: unit.kind,
        body: unit.body ?? null,
        resourceUrl: unit.resourceUrl ?? null,
        minutes: unit.minutes,
        sortOrder: unitIndex,
        quiz: unit.questions ? { questions: unit.questions } : null,
      });
    }
  }
  return rows;
}

export async function ensureLmsCatalog(supabase: SupabaseClient, tenantId: string) {
  const [{ data: existingCourses, error: courseReadError }, { data: existingModules, error: moduleReadError }] =
    await Promise.all([
      supabase.from("lms_courses").select("id, slug").eq("tenant_id", tenantId),
      supabase.from("lms_modules").select("course_id, slug").eq("tenant_id", tenantId),
    ]);
  if (courseReadError) throw new Error(courseReadError.message);
  if (moduleReadError) throw new Error(moduleReadError.message);

  let courses = (existingCourses ?? []) as Array<{ id: string; slug: string }>;
  const existingUnits = (existingModules ?? []) as Array<{ course_id: string; slug: string }>;
  if (catalogCoverageComplete(courses, existingUnits)) {
    return new Map(courses.map((course) => [course.slug, course]));
  }

  const missingCourses = missingCatalogCourses(new Set(courses.map((course) => course.slug)));
  if (missingCourses.length) {
    const { error: courseError } = await supabase.from("lms_courses").upsert(
      missingCourses.map((course) => ({
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
        sort_order: LMS_CATALOG.findIndex((item) => item.slug === course.slug),
      })),
      { onConflict: "tenant_id,slug" }
    );
    if (courseError) throw new Error(courseError.message);
    const { data: refreshed, error } = await supabase.from("lms_courses").select("id, slug").eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    courses = (refreshed ?? []) as Array<{ id: string; slug: string }>;
  }

  const coursesBySlug = new Map(courses.map((course) => [course.slug, course]));
  const modulesByCourse = new Map<string, Set<string>>();
  for (const unit of existingUnits) {
    const slugs = modulesByCourse.get(unit.course_id) ?? new Set<string>();
    slugs.add(unit.slug);
    modulesByCourse.set(unit.course_id, slugs);
  }

  const missingModules = missingCatalogModules(coursesBySlug, modulesByCourse);
  if (missingModules.length) {
    const { error: moduleError } = await supabase.from("lms_modules").upsert(
      missingModules.map((unit) => ({
        tenant_id: tenantId,
        course_id: unit.courseId,
        slug: unit.slug,
        title: unit.title,
        kind: unit.kind,
        body: unit.body,
        resource_url: unit.resourceUrl,
        estimated_minutes: unit.minutes,
        sort_order: unit.sortOrder,
        quiz: unit.quiz,
      })),
      { onConflict: "course_id,slug" }
    );
    if (moduleError) throw new Error(moduleError.message);
  }

  return coursesBySlug;
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
