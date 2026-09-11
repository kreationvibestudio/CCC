import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRetryQuiz,
  certificateCode,
  deploymentReadyFromEnrollments,
  gradeQuiz,
  isOverdue,
  nextIncompleteModule,
  overallPathStatus,
  effectiveTrainingStatus,
  firstAssignedCourseId,
  nextTrainingStatusFromLms,
  percentComplete,
  publishedCoursesForRoles,
  quizPassed,
} from "./progress.ts";
import { inferSupportRoles, parseSupportRoles } from "./roles.ts";
import { normalizeTrainingCode, readLearnToken, signLearnToken } from "./codes.ts";

describe("LMS progress", () => {
  it("treats in-progress people as not deployment ready", () => {
    assert.equal(
      deploymentReadyFromEnrollments([
        { required: true, status: "completed" },
        { required: true, status: "in_progress" },
      ]),
      false
    );
  });

  it("is ready only when every required course is completed", () => {
    assert.equal(
      deploymentReadyFromEnrollments([
        { required: true, status: "completed" },
        { required: false, status: "assigned" },
      ]),
      true
    );
    assert.equal(deploymentReadyFromEnrollments([]), false);
  });

  it("grades quizzes against a pass mark and retry cap", () => {
    const result = gradeQuiz(
      [
        { id: "a", answer: 1 },
        { id: "b", answer: 0 },
      ],
      { a: 1, b: 2 }
    );
    assert.equal(result.correct, 1);
    assert.equal(result.score, 50);
    assert.equal(quizPassed(70, 70), true);
    assert.equal(quizPassed(69, 70), false);
    assert.equal(canRetryQuiz(2, 3), true);
    assert.equal(canRetryQuiz(3, 3), false);
  });

  it("points at the next unfinished module", () => {
    const next = nextIncompleteModule(
      [
        { id: "1", sort_order: 1 },
        { id: "2", sort_order: 0 },
      ],
      new Set(["2"])
    );
    assert.equal(next?.id, "1");
  });

  it("computes path status and overdue flags", () => {
    assert.equal(overallPathStatus([{ required: true, status: "assigned" }]), "assigned");
    assert.equal(
      overallPathStatus([
        { required: true, status: "completed" },
        { required: true, status: "assigned" },
      ]),
      "in_progress"
    );
    assert.equal(percentComplete(1, 4), 25);
    assert.equal(isOverdue("2000-01-01T00:00:00.000Z", "assigned", new Date("2026-09-10")), true);
    assert.equal(isOverdue("2000-01-01T00:00:00.000Z", "completed", new Date("2026-09-10")), false);
  });

  it("marks HQ status in progress once an LMS course is started or completed", () => {
    assert.equal(
      effectiveTrainingStatus("pending", [
        { required: true, status: "completed" },
        { required: true, status: "assigned" },
      ]),
      "in_progress"
    );
    assert.equal(
      effectiveTrainingStatus("pending", [{ required: true, status: "in_progress" }]),
      "in_progress"
    );
    assert.equal(effectiveTrainingStatus("pending", [{ required: true, status: "assigned" }]), "pending");
    assert.equal(
      effectiveTrainingStatus("completed", [{ required: true, status: "assigned" }]),
      "completed"
    );
    assert.equal(
      effectiveTrainingStatus("completed", [{ required: true, status: "in_progress" }]),
      "in_progress"
    );
    assert.equal(effectiveTrainingStatus("in_progress", []), "in_progress");
    assert.equal(
      nextTrainingStatusFromLms({
        stored: "pending",
        enrollments: [
          { required: true, status: "completed" },
          { required: true, status: "completed" },
        ],
      }),
      "completed"
    );
  });

  it("picks the first assigned required course only before training has started", () => {
    assert.equal(
      firstAssignedCourseId([
        { course_id: "optional", status: "assigned", required: false },
        { course_id: "core", status: "assigned", required: true },
      ]),
      "core"
    );
    assert.equal(
      firstAssignedCourseId([
        { course_id: "core", status: "in_progress", required: true },
        { course_id: "next", status: "assigned", required: true },
      ]),
      null
    );
    assert.equal(firstAssignedCourseId([{ course_id: "gone", status: "removed", required: true }]), null);
  });

  it("builds a stable certificate code", () => {
    assert.equal(
      certificateCode("Ada Okonkwo", "core-campaign-briefing", new Date("2026-09-10T12:00:00Z")),
      "ADAO-CORE-20260910"
    );
  });
});

describe("support roles", () => {
  it("parses selected roles and infers from skills", () => {
    assert.deepEqual(parseSupportRoles(["field_canvassing", "nope"]), ["field_canvassing"]);
    assert.deepEqual(inferSupportRoles(["canvassing", "media"]), ["field_canvassing", "digital_outreach"]);
  });

  it("assigns the core briefing even when no support roles are selected", () => {
    const courses = [
      { id: "core", status: "published", role_slug: null },
      { id: "field", status: "published", role_slug: "field_canvassing" },
      { id: "draft", status: "draft", role_slug: null },
    ];
    assert.deepEqual(
      publishedCoursesForRoles(courses, []).map((c) => c.id),
      ["core"]
    );
    assert.deepEqual(
      publishedCoursesForRoles(courses, ["field_canvassing"]).map((c) => c.id),
      ["core", "field"]
    );
  });
});

describe("learn tokens", () => {
  it("round-trips a signed volunteer session", () => {
    const token = signLearnToken("vol-1", "ten-1");
    assert.deepEqual(readLearnToken(token), { volunteerId: "vol-1", tenantId: "ten-1" });
    assert.equal(readLearnToken("tampered." + token.split(".")[1]), null);
    assert.equal(normalizeTrainingCode("ab12-cd34"), "AB12CD34");
  });
});
