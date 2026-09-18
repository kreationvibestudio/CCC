import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commentMatchesStatusFilter,
  isHandledCommentStatus,
  normalizeCommentStatusFilter,
} from "./status-filter.ts";

describe("normalizeCommentStatusFilter", () => {
  it("defaults to needs_response", () => {
    assert.equal(normalizeCommentStatusFilter(undefined), "needs_response");
    assert.equal(normalizeCommentStatusFilter(""), "needs_response");
    assert.equal(normalizeCommentStatusFilter("bogus"), "needs_response");
  });

  it("accepts known filters", () => {
    assert.equal(normalizeCommentStatusFilter("all"), "all");
    assert.equal(normalizeCommentStatusFilter("replied"), "replied");
    assert.equal(normalizeCommentStatusFilter("Needs_Response"), "needs_response");
  });
});

describe("commentMatchesStatusFilter", () => {
  it("keeps open work on needs_response and hides handled", () => {
    assert.equal(commentMatchesStatusFilter("pending", "needs_response"), true);
    assert.equal(commentMatchesStatusFilter("assigned", "needs_response"), true);
    assert.equal(commentMatchesStatusFilter("flagged", "needs_response"), true);
    assert.equal(commentMatchesStatusFilter("replied", "needs_response"), false);
    assert.equal(commentMatchesStatusFilter("resolved", "needs_response"), false);
  });

  it("matches a single status or all", () => {
    assert.equal(commentMatchesStatusFilter("replied", "replied"), true);
    assert.equal(commentMatchesStatusFilter("pending", "replied"), false);
    assert.equal(commentMatchesStatusFilter("resolved", "all"), true);
  });
});

describe("isHandledCommentStatus", () => {
  it("marks replied and resolved as handled", () => {
    assert.equal(isHandledCommentStatus("replied"), true);
    assert.equal(isHandledCommentStatus("resolved"), true);
    assert.equal(isHandledCommentStatus("pending"), false);
  });
});
