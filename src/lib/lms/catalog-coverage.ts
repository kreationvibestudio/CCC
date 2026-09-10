export function catalogCoverageComplete(
  catalog: Array<{ slug: string; modules: Array<{ slug: string }> }>,
  courses: Array<{ id: string; slug: string }>,
  modules: Array<{ course_id: string; slug: string }>
) {
  const coursesBySlug = new Map(courses.map((course) => [course.slug, course]));
  const modulesByCourse = new Map<string, Set<string>>();
  for (const module of modules) {
    const slugs = modulesByCourse.get(module.course_id) ?? new Set<string>();
    slugs.add(module.slug);
    modulesByCourse.set(module.course_id, slugs);
  }
  for (const course of catalog) {
    const row = coursesBySlug.get(course.slug);
    if (!row) return false;
    const slugs = modulesByCourse.get(row.id);
    if (!slugs) return false;
    if (course.modules.some((module) => !slugs.has(module.slug))) return false;
  }
  return true;
}
