import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMediaBrief,
  mediaLineFromSignals,
  postsInLastDays,
  recommendNextPosts,
} from "./brief.ts";

const now = new Date("2026-09-13T07:00:00.000Z");

const roadsPost = {
  id: "best",
  content: "We are walking the Uromi–Ubiaja stretch this week and listening ward by ward.",
  likes: 220,
  comments_count: 40,
  shares: 18,
  engagement_rate: 4.2,
  posted_at: "2026-09-11T08:00:00.000Z",
};

const weakPost = {
  id: "worst",
  content: "Good morning Edo",
  likes: 4,
  comments_count: 1,
  shares: 0,
  engagement_rate: 0.1,
  posted_at: "2026-09-10T08:00:00.000Z",
};

test("posts older than seven days drop out of the ranking window", () => {
  const recent = postsInLastDays(
    [
      roadsPost,
      { ...weakPost, id: "old", posted_at: "2026-08-01T08:00:00.000Z" },
    ],
    7,
    now
  );
  assert.deepEqual(recent.map((post) => post.id), ["best"]);
});

test("recommendations follow issues, not a generic post-more line", () => {
  const next = recommendNextPosts({
    topIssues: ["roads", "employment"],
    pending: 18,
    misinfo: 2,
  });
  assert.equal(next.length, 3);
  assert.equal(next[0]?.topic, "roads");
  assert.match(next[0]?.talkingPoint ?? "", /stretch|ward/i);
  assert.equal(next[1]?.topic, "employment");
  assert.match(next[1]?.talkingPoint ?? "", /youth|job/i);
  assert.equal(next[2]?.topic, "fact-check");
  assert.ok(next.every((item) => !/post more/i.test(item.talkingPoint)));
});

test("media brief names best and worst posts and builds a WhatsApp huddle", () => {
  const brief = buildMediaBrief({
    totals: {
      total: 20,
      positive: 8,
      neutral: 4,
      negative: 8,
      misinformation: 2,
      topIssues: ["roads", "employment", "other"],
    },
    pending: 12,
    flagged: 3,
    misinfo: 2,
    posts: [roadsPost, weakPost],
    now,
  });

  assert.equal(brief.bestPost?.id, "best");
  assert.equal(brief.worstPost?.id, "worst");
  assert.deepEqual(brief.topIssues, ["roads", "employment"]);
  assert.equal(brief.nextPosts[0]?.topic, "roads");
  assert.match(brief.mediaLine, /draft a roads post/i);
  assert.match(brief.huddleText, /Media huddle/);
  assert.match(brief.huddleText, /12 pending/);
  assert.match(brief.huddleText, /Uromi/);
  assert.match(brief.huddleText, /Good morning Edo/);
  assert.match(brief.huddleText, /Meta Business Suite/);
});

test("empty activity stays at zero and still has a huddle line", () => {
  const brief = buildMediaBrief({
    totals: { total: 0, positive: 0, neutral: 0, negative: 0, misinformation: 0, topIssues: [] },
    pending: 0,
    flagged: 0,
    misinfo: 0,
    posts: [],
    now,
  });
  assert.equal(brief.bestPost, null);
  assert.deepEqual(brief.nextPosts, []);
  assert.match(brief.summary, /No campaign activity/);
  assert.equal(brief.mediaLine, "Media desk: inbox clear.");
  assert.match(brief.huddleText, /Hold replies/);
});

test("one-line pin prefers the first recommended post", () => {
  assert.match(
    mediaLineFromSignals({
      nextPosts: [{ topic: "roads", talkingPoint: "x", why: "y" }],
      pending: 4,
      misinfo: 1,
    }),
    /Today: draft a roads post\. 4 pending, 1 misinfo/
  );
});
