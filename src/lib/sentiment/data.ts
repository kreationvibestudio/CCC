import { createClient } from "@/lib/supabase/server";

export async function getSentimentData(tenantId: string) {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select("sentiment, issue_topic, created_at, ward, lga")
    .eq("tenant_id", tenantId);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const issueMap = new Map<string, number>();
  const byWeek = new Map<string, { positive: number; negative: number; neutral: number }>();
  const byWard = new Map<string, { positive: number; negative: number; neutral: number }>();

  for (const c of comments ?? []) {
    if (c.sentiment && c.sentiment in sentiment) {
      sentiment[c.sentiment as keyof typeof sentiment]++;
    }
    if (c.issue_topic) issueMap.set(c.issue_topic, (issueMap.get(c.issue_topic) ?? 0) + 1);

    const week = c.created_at?.slice(0, 10) ?? "unknown";
    const wk = byWeek.get(week) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") wk.positive++;
    else if (c.sentiment === "negative") wk.negative++;
    else wk.neutral++;
    byWeek.set(week, wk);

    const ward = c.ward || "Unknown";
    const wr = byWard.get(ward) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") wr.positive++;
    else if (c.sentiment === "negative") wr.negative++;
    else wr.neutral++;
    byWard.set(ward, wr);
  }

  const issueBreakdown = [...issueMap.entries()]
    .map(([topic, count]) => ({ topic: topic.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count);

  const trend = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => ({ date, ...v }));

  const wardBreakdown = [...byWard.entries()]
    .map(([ward, v]) => ({ ward, total: v.positive + v.neutral + v.negative, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { sentiment, issueBreakdown, total: comments?.length ?? 0, trend, wardBreakdown };
}
