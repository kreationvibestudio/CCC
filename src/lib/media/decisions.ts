import {
  buildDecisionCalls,
  pct,
  type DecisionCall,
  type DecisionInput,
} from "../analytics/decisions.ts";
import type { Comment } from "../../types/database.ts";

const MEDIA_CALL_IDS = new Set([
  "misinfo",
  "comment-backlog",
  "issue-message",
  "sentiment-slide",
  "flagged",
]);

export function mediaDecisionCalls(input: DecisionInput): DecisionCall[] {
  const calls = buildDecisionCalls({
    ...input,
    agentCoveragePct: 100,
    uncoveredHighRiskPus: 0,
    uncoveredHighVoterPus: 0,
    volunteersTrainedPct: 100,
    undecidedContacts: 0,
    totalContacts: 0,
    upcomingEvents: 1,
    pressureWard: null,
  });

  const media = calls
    .filter((call) => MEDIA_CALL_IDS.has(call.id) || call.id === "hold-course")
    .map((call) => (call.id === "issue-message" ? { ...call, href: "/media" } : call));

  return media.slice(0, 5);
}

export function hotIssueFromComments(comments: Comment[]) {
  const map = new Map<string, { negative: number; total: number }>();
  for (const comment of comments) {
    const topic = comment.issue_topic ?? "other";
    if (topic === "other") continue;
    const cur = map.get(topic) ?? { negative: 0, total: 0 };
    cur.total += 1;
    if (comment.sentiment === "negative") cur.negative += 1;
    map.set(topic, cur);
  }

  let best: { topic: string; negative: number; total: number } | null = null;
  for (const [topic, value] of map) {
    if (
      !best ||
      value.negative > best.negative ||
      (value.negative === best.negative && value.total > best.total)
    ) {
      best = { topic, ...value };
    }
  }
  return best;
}

export function recentNegativeDelta(comments: Comment[], now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  let recent = 0;
  let prior = 0;
  for (const comment of comments) {
    if (comment.sentiment !== "negative") continue;
    const age = now.getTime() - new Date(comment.created_at).getTime();
    if (age <= 3 * day) recent += 1;
    else if (age <= 6 * day) prior += 1;
  }
  return recent - prior;
}

export function decisionInputFromComments(comments: Comment[], now = new Date()): DecisionInput {
  const classified = comments.filter((comment) => comment.sentiment);
  const positive = classified.filter((comment) => comment.sentiment === "positive").length;
  const negative = classified.filter((comment) => comment.sentiment === "negative").length;
  const pending = comments.filter((comment) => comment.status === "pending").length;
  const flagged = comments.filter((comment) => comment.status === "flagged").length;
  const misinfoOpen = comments.filter(
    (comment) => comment.is_misinformation && comment.status !== "resolved"
  ).length;

  return {
    daysToElection: null,
    pendingComments: pending,
    misinfoOpen,
    flaggedComments: flagged,
    sentimentScore: classified.length ? Math.round((positive / classified.length) * 100) : 50,
    negativeShare: pct(negative, classified.length),
    recentNegativeDelta: recentNegativeDelta(comments, now),
    agentCoveragePct: 100,
    uncoveredHighRiskPus: 0,
    uncoveredHighVoterPus: 0,
    volunteersTrainedPct: 100,
    undecidedContacts: 0,
    totalContacts: 0,
    upcomingEvents: 1,
    hotIssue: hotIssueFromComments(comments),
    pressureWard: null,
  };
}
