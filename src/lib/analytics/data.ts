import { createClient } from "@/lib/supabase/server";

export async function getAnalyticsSummary(tenantId: string) {
  const supabase = await createClient();
  const [
    { count: volunteers },
    { count: contacts },
    { count: events },
    { count: comments },
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

  const { data: sentimentRows } = await supabase
    .from("comments")
    .select("sentiment")
    .eq("tenant_id", tenantId)
    .not("sentiment", "is", null);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentimentRows ?? []) {
    if (row.sentiment && row.sentiment in sentiment) {
      sentiment[row.sentiment as keyof typeof sentiment]++;
    }
  }

  return {
    volunteers: volunteers ?? 0,
    contacts: contacts ?? 0,
    events: events ?? 0,
    comments: comments ?? 0,
    pollingUnits: pollingUnits ?? 0,
    incidents: incidents ?? 0,
    sentiment,
  };
}
