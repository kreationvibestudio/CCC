import type { Comment } from "@/types/database";
import type { DashboardBriefing } from "@/lib/dashboard-data";

export function generateBriefingFromComments(
  comments: Pick<Comment, "content" | "sentiment" | "issue_topic" | "is_misinformation">[],
  postsCount: number,
  totalLikes: number
): DashboardBriefing {
  const total = comments.length || 1;
  const positive = comments.filter((c) => c.sentiment === "positive").length;
  const neutral = comments.filter((c) => c.sentiment === "neutral").length;
  const negative = comments.filter((c) => c.sentiment === "negative").length;

  const issueCounts: Record<string, number> = {};
  for (const c of comments) {
    const topic = c.issue_topic ?? "other";
    issueCounts[topic] = (issueCounts[topic] ?? 0) + 1;
  }
  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const misinfo = comments.filter((c) => c.is_misinformation).length;
  const sentimentPct = Math.round((positive / total) * 100);

  const recommendations: string[] = [];
  if (topIssues.includes("roads")) recommendations.push("Address road infrastructure in ward meetings and social posts");
  if (topIssues.includes("employment")) recommendations.push("Publish youth employment plan content today");
  if (misinfo > 0) recommendations.push("Deploy fact-check team for misinformation trends");
  if (negative > positive) recommendations.push("Increase direct voter engagement in areas with negative sentiment");
  if (recommendations.length === 0) recommendations.push("Maintain current messaging — sentiment is stable");

  return {
    summary: `${postsCount} Facebook posts synced with ${comments.length} comments. Sentiment is ${sentimentPct}% positive. ${totalLikes.toLocaleString()} total likes on recent posts.${misinfo ? ` ${misinfo} misinformation flag(s) detected.` : ""}`,
    topIssues: topIssues.length ? topIssues : ["other"],
    recommendations,
    sentimentBreakdown: {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    },
  };
}
