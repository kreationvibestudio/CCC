import { LMS_CATALOG } from "./catalog";

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlText(value: string | null | undefined) {
  if (value == null) return "NULL";
  return sqlString(value);
}

function sqlJson(value: unknown) {
  if (value == null) return "NULL";
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const LMS_TABLES = [
  "lms_courses",
  "lms_modules",
  "lms_enrollments",
  "lms_module_progress",
  "lms_quiz_attempts",
  "lms_certificates",
  "lms_live_sessions",
  "lms_session_attendees",
  "lms_activity_logs",
] as const;

/** Grants + real curriculum upserts for every tenant. No volunteer sample rows. */
export function lmsCatalogSeedSql() {
  const grants = LMS_TABLES.map(
    (table) =>
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${table} TO authenticated, service_role;`
  );

  const courses = LMS_CATALOG.map((course, index) => {
    return `INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  ${sqlString(course.slug)},
  ${sqlString(course.title)},
  ${sqlString(course.description)},
  ${course.roleSlug ? sqlString(course.roleSlug) : "NULL"},
  ${course.minutes},
  'published',
  70,
  3,
  TRUE,
  ${index}
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;`;
  });

  const modules = LMS_CATALOG.flatMap((course) =>
    course.modules.map((module, moduleIndex) => {
      return `INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  ${sqlString(module.slug)},
  ${sqlString(module.title)},
  ${sqlString(module.kind)},
  ${sqlText(module.body)},
  ${sqlText(module.resourceUrl)},
  ${module.minutes},
  ${moduleIndex},
  ${module.questions ? sqlJson({ questions: module.questions }) : "NULL"}
FROM public.lms_courses c
WHERE c.slug = ${sqlString(course.slug)}
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;`;
    })
  );

  return [
    "-- LMS grants + published curriculum for every campaign tenant.",
    "-- Does not insert volunteers, quiz attempts, or certificates.",
    ...grants,
    ...courses,
    ...modules,
  ].join("\n\n");
}
