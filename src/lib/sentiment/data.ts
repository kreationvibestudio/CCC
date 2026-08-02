import { createClient } from "@/lib/supabase/server";

export async function getSentimentData(tenantId: string) {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select("sentiment, issue_topic")
    .eq("tenant_id", tenantId);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const issueMap = new Map<string, number>();

  for (const c of comments ?? []) {
    if (c.sentiment && c.sentiment in sentiment) {
      sentiment[c.sentiment as keyof typeof sentiment]++;
    }
    if (c.issue_topic) {
      issueMap.set(c.issue_topic, (issueMap.get(c.issue_topic) ?? 0) + 1);
    }
  }

  const issueBreakdown = [...issueMap.entries()]
    .map(([topic, count]) => ({ topic: topic.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count);

  return { sentiment, issueBreakdown, total: comments?.length ?? 0 };
}
