import type { CommentTotals } from "../ai/briefing.ts";
import { talkingPointFor } from "./topics.ts";

export type MediaPostSnapshot = {
  id: string;
  content: string;
  likes: number;
  comments_count: number;
  shares: number;
  engagement_rate: number;
  posted_at: string | null;
};

export type RecommendedPost = {
  topic: string;
  talkingPoint: string;
  why: string;
};

export type MediaBriefInput = {
  totals: CommentTotals;
  pending: number;
  flagged: number;
  misinfo: number;
  posts: MediaPostSnapshot[];
  now?: Date;
};

export type MediaBrief = {
  summary: string;
  mediaLine: string;
  topIssues: string[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  pending: number;
  flagged: number;
  misinfo: number;
  bestPost: MediaPostSnapshot | null;
  worstPost: MediaPostSnapshot | null;
  nextPosts: RecommendedPost[];
  huddleText: string;
};

function engagementScore(post: MediaPostSnapshot) {
  if (post.engagement_rate > 0) return post.engagement_rate;
  return post.likes + post.comments_count + post.shares;
}

function snippet(content: string, max = 72) {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return "(no caption)";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function postsInLastDays(
  posts: MediaPostSnapshot[],
  days: number,
  now = new Date()
): MediaPostSnapshot[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return posts.filter((post) => {
    if (!post.posted_at) return false;
    const time = new Date(post.posted_at).getTime();
    return Number.isFinite(time) && time >= cutoff && time <= now.getTime();
  });
}

export function rankPosts(posts: MediaPostSnapshot[]) {
  const scored = [...posts].sort((a, b) => engagementScore(b) - engagementScore(a));
  return {
    best: scored[0] ?? null,
    worst: scored.length > 1 ? scored[scored.length - 1] : scored[0] ?? null,
  };
}

export function recommendNextPosts(input: {
  topIssues: string[];
  pending: number;
  misinfo: number;
  worstPostTopic?: string | null;
}): RecommendedPost[] {
  const next: RecommendedPost[] = [];
  const seen = new Set<string>();

  for (const topic of input.topIssues) {
    if (next.length >= 3) break;
    const key = topic || "other";
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      topic: key,
      talkingPoint: talkingPointFor(key),
      why: `${key} is in the comment heat right now`,
    });
  }

  if (input.misinfo > 0 && next.length < 3 && !seen.has("fact-check")) {
    seen.add("fact-check");
    next.push({
      topic: "fact-check",
      talkingPoint: "Post a short correction: what is false, what is true, no invented claims",
      why: `${input.misinfo} misinformation flag${input.misinfo === 1 ? "" : "s"} still open`,
    });
  }

  if (input.pending >= 10 && next.length < 3 && !seen.has("inbox")) {
    seen.add("inbox");
    next.push({
      topic: "inbox",
      talkingPoint: "Thank commenters and ask for ward — clear the backlog before a new slogan post",
      why: `${input.pending} comments are still pending`,
    });
  }

  if (input.worstPostTopic && next.length < 3 && !seen.has(input.worstPostTopic)) {
    seen.add(input.worstPostTopic);
    next.push({
      topic: input.worstPostTopic,
      talkingPoint: talkingPointFor(input.worstPostTopic),
      why: "Last week's weakest post was on this beat — rewrite with a concrete next step",
    });
  }

  return next.slice(0, 3);
}

export function mediaLineFromSignals(input: {
  nextPosts: RecommendedPost[];
  pending: number;
  misinfo: number;
}): string {
  const queue =
    input.pending || input.misinfo
      ? `${input.pending} pending, ${input.misinfo} misinfo`
      : "inbox clear";
  const first = input.nextPosts[0];
  if (first) {
    if (first.topic === "inbox") return `Today: clear the comment backlog. ${queue}.`;
    if (first.topic === "fact-check") return `Today: post a short fact-check. ${queue}.`;
    return `Comment heat: ${first.topic}. HQ picks the beat. ${queue}.`;
  }
  return `Media desk: ${queue}. Pick a beat to own.`;
}

function huddleDate(now: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}

export function formatHuddleText(brief: Omit<MediaBrief, "huddleText">, now = new Date()): string {
  const issues = brief.topIssues.length ? brief.topIssues.join(", ") : "none yet";
  const next = brief.nextPosts.length
    ? brief.nextPosts.map((item, i) => `${i + 1}. ${item.topic}: ${item.talkingPoint}`).join("\n")
    : "1. Hold replies until a real issue surfaces — do not invent a post";
  const best = brief.bestPost
    ? `"${snippet(brief.bestPost.content)}" (${brief.bestPost.likes} likes)`
    : "no Facebook post in the last 7 days";
  const watch = brief.worstPost && brief.bestPost && brief.worstPost.id !== brief.bestPost.id
    ? `"${snippet(brief.worstPost.content)}"`
    : "same as best — only one recent post";

  return [
    `*Media huddle — ${huddleDate(now)}*`,
    `Sentiment: ${brief.sentimentBreakdown.positive}% pos / ${brief.sentimentBreakdown.negative}% neg`,
    `Inbox: ${brief.pending} pending · ${brief.flagged} flagged · ${brief.misinfo} misinfo`,
    `Heat: ${issues}`,
    `Best post: ${best}`,
    `Watch: ${watch}`,
    `Heat suggestions (HQ still picks the beat):`,
    next,
    `Copy into Meta Business Suite. Do not invent promises.`,
  ].join("\n");
}

export function buildMediaBrief(input: MediaBriefInput): MediaBrief {
  const now = input.now ?? new Date();
  const denominator = input.totals.total || 1;
  const topIssues = input.totals.topIssues.filter((topic) => topic && topic !== "other").slice(0, 5);
  const recent = postsInLastDays(input.posts, 7, now);
  const { best, worst } = rankPosts(recent);
  const nextPosts = recommendNextPosts({
    topIssues,
    pending: input.pending,
    misinfo: input.misinfo,
    worstPostTopic: null,
  });
  const sentimentBreakdown = input.totals.total
    ? {
        positive: Math.round((input.totals.positive / denominator) * 100),
        neutral: Math.round((input.totals.neutral / denominator) * 100),
        negative: Math.round((input.totals.negative / denominator) * 100),
      }
    : { positive: 0, neutral: 0, negative: 0 };

  const sentimentPct = sentimentBreakdown.positive;
  const summary =
    input.totals.total === 0 && input.posts.length === 0
      ? "No campaign activity yet. Figures stay at zero until Facebook syncs."
      : `${input.totals.total} comments · ${sentimentPct}% positive · ${input.pending} pending · ${input.misinfo} misinfo. ${recent.length} Facebook post${recent.length === 1 ? "" : "s"} in the last 7 days.`;

  const draft: Omit<MediaBrief, "huddleText"> = {
    summary,
    mediaLine: mediaLineFromSignals({ nextPosts, pending: input.pending, misinfo: input.misinfo }),
    topIssues,
    sentimentBreakdown,
    pending: input.pending,
    flagged: input.flagged,
    misinfo: input.misinfo,
    bestPost: best,
    worstPost: worst && best && worst.id === best.id ? null : worst,
    nextPosts,
  };

  return { ...draft, huddleText: formatHuddleText(draft, now) };
}
