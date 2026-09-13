import assert from "node:assert/strict";
import { test } from "node:test";
import { decisionInputFromComments, mediaDecisionCalls } from "./decisions.ts";
import type { Comment } from "../../types/database.ts";

function comment(partial: Partial<Comment>): Comment {
  return {
    id: partial.id ?? "c1",
    tenant_id: "t1",
    platform: "facebook",
    platform_comment_id: "p1",
    author_name: "Ada",
    content: "roads again",
    priority_score: 80,
    status: "pending",
    is_misinformation: false,
    is_abusive: false,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

test("war-room calls keep misinfo and backlog, drop field coverage", () => {
  const comments = [
    comment({ id: "1", is_misinformation: true, status: "flagged", issue_topic: "roads", sentiment: "negative" }),
    ...Array.from({ length: 16 }, (_, i) =>
      comment({ id: `p${i}`, status: "pending", issue_topic: "roads", sentiment: "negative" })
    ),
  ];
  const calls = mediaDecisionCalls(decisionInputFromComments(comments));
  assert.ok(calls.some((call) => call.id === "misinfo"));
  assert.ok(calls.some((call) => call.id === "comment-backlog"));
  assert.ok(calls.every((call) => call.id !== "high-risk-coverage"));
  const issue = calls.find((call) => call.id === "issue-message");
  if (issue) assert.equal(issue.href, "/media");
});

test("calm inbox yields hold-course", () => {
  const calls = mediaDecisionCalls(
    decisionInputFromComments([
      comment({ status: "replied", sentiment: "positive", issue_topic: "youth" }),
    ])
  );
  assert.equal(calls[0]?.id, "hold-course");
});
