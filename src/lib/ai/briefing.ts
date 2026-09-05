import type { DashboardBriefing } from "@/lib/dashboard-data";

/**
 * Whole-workspace comment totals, as counted by the database rather than by
 * reducing a fetched page. Percentages derived from a 1000-row prefix drift
 * badly once an inbox is larger than that.
 */
export type CommentTotals = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  misinformation: number;
  /** Most frequent issue topics, already ordered by frequency. */
  topIssues: string[];
};

export function briefingFromTotals(
  totals: CommentTotals,
  postsCount: number,
  totalLikes: number
): DashboardBriefing {
  if (totals.total === 0 && postsCount === 0) {
    return {
      summary: "No campaign activity yet. Figures stay at zero until you add data or sync social accounts.",
      topIssues: [],
      recommendations: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    };
  }

  const denominator = totals.total || 1;
  const topIssues = totals.topIssues.slice(0, 5);
  const sentimentPct = totals.total ? Math.round((totals.positive / totals.total) * 100) : 0;

  const recommendations: string[] = [];
  if (topIssues.includes("roads")) recommendations.push("Address road infrastructure in ward meetings and social posts");
  if (topIssues.includes("employment")) recommendations.push("Publish youth employment plan content today");
  if (totals.misinformation > 0) recommendations.push("Deploy fact-check team for misinformation trends");
  if (totals.negative > totals.positive) {
    recommendations.push("Increase direct voter engagement in areas with negative sentiment");
  }

  return {
    summary: `${postsCount} Facebook posts synced with ${totals.total} comments. Sentiment is ${sentimentPct}% positive. ${totalLikes.toLocaleString()} total likes.${totals.misinformation ? ` ${totals.misinformation} misinformation flag(s) detected.` : ""}`,
    topIssues,
    recommendations,
    sentimentBreakdown: {
      positive: Math.round((totals.positive / denominator) * 100),
      neutral: Math.round((totals.neutral / denominator) * 100),
      negative: Math.round((totals.negative / denominator) * 100),
    },
  };
}

/** Nullable fields on purpose: these columns are all nullable in Postgres. */
type CommentSample = {
  sentiment?: string | null;
  issue_topic?: string | null;
  is_misinformation?: boolean | null;
};

export function totalsFromComments(comments: CommentSample[]): CommentTotals {
  const issueCounts = new Map<string, number>();
  for (const c of comments) {
    const topic = c.issue_topic ?? "other";
    issueCounts.set(topic, (issueCounts.get(topic) ?? 0) + 1);
  }

  return {
    total: comments.length,
    positive: comments.filter((c) => c.sentiment === "positive").length,
    neutral: comments.filter((c) => c.sentiment === "neutral").length,
    negative: comments.filter((c) => c.sentiment === "negative").length,
    misinformation: comments.filter((c) => c.is_misinformation).length,
    topIssues: [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic),
  };
}