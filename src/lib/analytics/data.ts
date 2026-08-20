import { createClient } from "@/lib/supabase/server";
import { generateBriefingFromComments } from "@/lib/ai/briefing";

export async function getAnalyticsSummary(tenantId: string) {
  const supabase = await createClient();
  const [
    { count: volunteers },
    { count: contacts },
    { count: events },
    { count: commentCount },
    { count: pollingUnits },
    { count: incidents },
  ] = await Promise.all([
    supabase.from("volunteers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("campaign_events").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("polling_units").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("incident_reports").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const { data: sentimentRows } = await supabase.from("comments").select("sentiment").eq("tenant_id", tenantId).not("sentiment", "is", null);
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentimentRows ?? []) {
    if (row.sentiment && row.sentiment in sentiment) sentiment[row.sentiment as keyof typeof sentiment]++;
  }

  const { data: donations } = await supabase.from("donations").select("amount, created_at").eq("tenant_id", tenantId).order("created_at");
  const donationTrend = (donations ?? []).slice(-12).map((d, i) => ({ month: `M${i + 1}`, amount: Number(d.amount) }));

  const rpcWards = await supabase.rpc("top_polling_wards", { p_limit: 8 });
  const geographic = Array.isArray(rpcWards.data)
    ? rpcWards.data.map((row: { ward?: string; voters?: number }) => ({
        ward: row.ward ?? "Unknown",
        voters: Number(row.voters ?? 0),
      }))
    : [];

  const { data: posts } = await supabase.from("social_posts").select("likes, comments_count, shares").eq("tenant_id", tenantId);
  const socialEngagement = (posts ?? []).reduce((s, p) => s + (p.likes ?? 0) + (p.comments_count ?? 0) + (p.shares ?? 0), 0);

  let aiInsight = "";
  try {
    const { data: commentRows } = await supabase.from("comments").select("content, sentiment, issue_topic, is_misinformation").eq("tenant_id", tenantId).limit(100);
    const { count: postCount } = await supabase.from("social_posts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    const briefing = generateBriefingFromComments(commentRows ?? [], postCount ?? 0, socialEngagement);
    aiInsight = briefing.summary;
  } catch {
    aiInsight = "Sync comments to generate AI insights.";
  }

  return {
    volunteers: volunteers ?? 0,
    contacts: contacts ?? 0,
    events: events ?? 0,
    comments: commentCount ?? 0,
    pollingUnits: pollingUnits ?? 0,
    incidents: incidents ?? 0,
    sentiment,
    donationTrend,
    geographic,
    socialEngagement,
    aiInsight,
  };
}
