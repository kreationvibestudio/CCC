import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fallbackDraftPost,
  packTalkingPoints,
  unpackTalkingPoints,
} from "./draft-fallback.ts";

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

test("fallback roads draft stays under 280 characters and names the issue", () => {
  const draft = fallbackDraftPost("roads", ["The Uromi road is washed out again after last night's rain"]);
  assert.match(draft.title, /roads/i);
  assert.ok(draft.body.length <= 280);
  assert.match(draft.body, /roads/i);
  assert.match(draft.body, /Uromi/i);
  assert.ok(draft.talking_points.length >= 1);
  assert.ok(draft.talking_points.some((point) => /ward|stretch/i.test(point)));
  assert.equal(draft.tone, "listen");
});

test("fallback fact-check draft does not invent a programme", () => {
  const draft = fallbackDraftPost("fact-check");
  assert.match(draft.body, /rumour|verify/i);
  assert.ok(!/promise|we will build|budget/i.test(draft.body));
});

test("agenda employment draft is thought-provoking and includes an article", () => {
  const draft = fallbackDraftPost("employment", [], "agenda");
  assert.equal(draft.tone, "agenda");
  assert.match(draft.body, /question/i);
  assert.ok(draft.body.length > 80);
  assert.ok(wordCount(draft.article) >= 80);
  assert.match(draft.article, /Akhakon Anenih/i);
  assert.ok(!/stole|criminal|scandal/i.test(draft.body + draft.article));
});

test("shake draft asks APC hard questions without inventing accusations", () => {
  const draft = fallbackDraftPost("employment", ["No jobs in my ward"], "shake");
  assert.equal(draft.tone, "shake");
  assert.match(draft.body, /APC/i);
  assert.match(draft.body, /jobs|employment|covered/i);
  assert.match(draft.article, /ward/i);
  assert.ok(wordCount(draft.article) >= 80);
  assert.ok(!/stole|embezzl|arrest|criminal/i.test(`${draft.body} ${draft.article}`));
  assert.match(draft.article, /will not write a crime/i);
});

test("pack and unpack keep the article and tone on talking_points", () => {
  const draft = fallbackDraftPost("youth", [], "agenda");
  const packed = packTalkingPoints(draft);
  const unpacked = unpackTalkingPoints(packed);
  assert.equal(unpacked.tone, "agenda");
  assert.equal(unpacked.article, draft.article);
  assert.ok(unpacked.points.length >= 1);
  assert.ok(!unpacked.points.some((point) => point.startsWith("article:")));
});

test("legacy talking_points without prefixes still unpack", () => {
  const unpacked = unpackTalkingPoints(["Ask for the ward", "Do not invent a timeline"]);
  assert.equal(unpacked.tone, null);
  assert.equal(unpacked.article, null);
  assert.equal(unpacked.points.length, 2);
});
