export function catalogCoverageComplete(
  catalog: Array<{ slug: string; modules: Array<{ slug: string }> }>,
  courses: Array<{ id: string; slug: string }>,
  modules: Array<{ course_id: string; slug: string }>
) {
  const coursesBySlug = new Map(courses.map((course) => [course.slug, course]));
  const modulesByCourse = new Map<string, Set<string>>();
  for (const unit of modules) {
    const slugs = modulesByCourse.get(unit.course_id) ?? new Set<string>();
    slugs.add(unit.slug);
    modulesByCourse.set(unit.course_id, slugs);
  }
  for (const course of catalog) {
    const row = coursesBySlug.get(course.slug);
    if (!row) return false;
    const slugs = modulesByCourse.get(row.id);
    if (!slugs) return false;
    if (course.modules.some((unit) => !slugs.has(unit.slug))) return false;
  }
  return true;
}
