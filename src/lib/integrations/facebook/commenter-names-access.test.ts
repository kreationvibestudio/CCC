import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMMENTER_NAMES_FEATURE,
  COMMENTER_NAMES_REVIEW_USE_CASE,
  hiddenCommenterSummary,
} from "./commenter-names-access.ts";

test("App Review copy names the feature and stays short enough to paste", () => {
  assert.match(COMMENTER_NAMES_REVIEW_USE_CASE, /Page comments/);
  assert.match(COMMENTER_NAMES_REVIEW_USE_CASE, /name/);
  assert.ok(COMMENTER_NAMES_REVIEW_USE_CASE.length >= 200);
  assert.ok(COMMENTER_NAMES_REVIEW_USE_CASE.length <= 2000);
});

test("inbox summary is plain language, not only the Meta feature name", () => {
  const summary = hiddenCommenterSummary(47);
  assert.match(summary, /47 visitor names/);
  assert.match(summary, new RegExp(COMMENTER_NAMES_FEATURE));
  assert.match(summary, /will not create them/i);
});
