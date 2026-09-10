import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("LMS catalog seed SQL", () => {
  it("publishes core briefing, role courses, and quizzes without volunteer sample rows", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260910180000_lms_grants_and_catalog.sql"),
      "utf8"
    );
    assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.lms_courses/);
    assert.match(sql, /core-campaign-briefing/);
    assert.match(sql, /core-quiz/);
    assert.match(sql, /role-field_canvassing/);
    assert.match(sql, /role-quiz/);
    assert.equal((sql.match(/INSERT INTO public\.lms_courses/g) ?? []).length, 11);
    assert.doesNotMatch(sql, /DEMO-CORE/);
    assert.doesNotMatch(sql, /INSERT INTO public\.volunteers/);
    assert.doesNotMatch(sql, /INSERT INTO public\.lms_certificates/);
  });
});
