import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackDraftPost } from "./draft-fallback.ts";

test("fallback roads draft stays under 280 characters and names the issue", () => {
  const draft = fallbackDraftPost("roads", ["The Uromi road is washed out again after last night's rain"]);
  assert.match(draft.title, /roads/i);
  assert.ok(draft.body.length <= 280);
  assert.match(draft.body, /roads/i);
  assert.match(draft.body, /Uromi/i);
  assert.ok(draft.talking_points.length >= 1);
  assert.ok(draft.talking_points.some((point) => /ward|stretch/i.test(point)));
});

test("fallback fact-check draft does not invent a programme", () => {
  const draft = fallbackDraftPost("fact-check");
  assert.match(draft.body, /rumour|verify/i);
  assert.ok(!/promise|we will build|budget/i.test(draft.body));
});
