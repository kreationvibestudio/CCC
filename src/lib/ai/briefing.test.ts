import assert from "node:assert/strict";
import { test } from "node:test";
import { briefingFromTotals, totalsFromComments } from "./briefing.ts";

test("an empty workspace reports zeros, not a divide-by-zero", () => {
  const briefing = briefingFromTotals(totalsFromComments([]), 0, 0);
  assert.deepEqual(briefing.sentimentBreakdown, { positive: 0, neutral: 0, negative: 0 });
  assert.deepEqual(briefing.topIssues, []);
  assert.deepEqual(briefing.recommendations, []);
  assert.match(briefing.summary, /No campaign activity yet/);
});

test("totals are counted, not sampled", () => {
  const totals = totalsFromComments([
    { sentiment: "positive", issue_topic: "roads", is_misinformation: false },
    { sentiment: "positive", issue_topic: "roads", is_misinformation: false },
    { sentiment: "negative", issue_topic: "employment", is_misinformation: true },
    { sentiment: null, issue_topic: null, is_misinformation: null },
  ]);
  assert.equal(totals.total, 4);
  assert.equal(totals.positive, 2);
  assert.equal(totals.negative, 1);
  assert.equal(totals.misinformation, 1);
  assert.deepEqual(totals.topIssues, ["roads", "employment", "other"]);
});

test("the summary quotes whole-workspace totals, not the fetched page", () => {
  // What the dashboard now passes: counts the database produced, which can be
  // far larger than any single PostgREST response.
  const briefing = briefingFromTotals(
    { total: 12_400, positive: 6_200, neutral: 3_100, negative: 3_100, misinformation: 12, topIssues: ["roads"] },
    840,
    99_000
  );
  assert.match(briefing.summary, /840 Facebook posts/);
  assert.match(briefing.summary, /12400 comments/);
  assert.match(briefing.summary, /50% positive/);
  assert.match(briefing.summary, /12 misinformation flag/);
});

test("recommendations follow the issues and the sentiment balance", () => {
  const negative = briefingFromTotals(
    { total: 10, positive: 2, neutral: 1, negative: 7, misinformation: 3, topIssues: ["roads", "employment"] },
    5,
    10
  );
  assert.ok(negative.recommendations.some((r) => /road infrastructure/.test(r)));
  assert.ok(negative.recommendations.some((r) => /youth employment/.test(r)));
  assert.ok(negative.recommendations.some((r) => /fact-check/.test(r)));
  assert.ok(negative.recommendations.some((r) => /negative sentiment/.test(r)));

  const healthy = briefingFromTotals(
    { total: 10, positive: 8, neutral: 1, negative: 1, misinformation: 0, topIssues: ["security"] },
    5,
    10
  );
  assert.deepEqual(healthy.recommendations, []);
});

test("only the top five issues reach the briefing", () => {
  const topIssues = ["a", "b", "c", "d", "e", "f", "g"];
  const briefing = briefingFromTotals(
    { total: 7, positive: 7, neutral: 0, negative: 0, misinformation: 0, topIssues },
    1,
    1
  );
  assert.deepEqual(briefing.topIssues, ["a", "b", "c", "d", "e"]);
});
