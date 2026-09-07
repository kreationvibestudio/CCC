import { createClient } from "@/lib/supabase/server";
import { briefingFromTotals, totalsFromComments } from "@/lib/ai/briefing";
import { applyCampaignStateFilter } from "@/lib/polling-units/scope";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { isMissingColumnError } from "@/lib/public-error";
import {
  buildDecisionCalls,
  daysUntil,
  pct,
  type DecisionCall,
} from "@/lib/analytics/decisions";

export type AnalyticsSummary = Awaited<ReturnType<typeof getAnalyticsSummary>>;

type HotIssue = { topic: string; total: number; negative: number; pressure: number };
type PressureWard = { ward: string; negative: number; total: number; negativePct: number };
type CoverageGap = {
  code: string;
  name: string;
  ward: string;
  lga: string;
  registered_voters: number;
  risk_level: string;
};

export async function getAnalyticsSummary(tenantId: string) {
  const supabase = await createClient();

  const tenantWithStart = await supabase
    .from("tenants")
    .select("election_date, campaign_end_date, campaign_start_date, fundraising_goal")
    .eq("id", tenantId)
    .single();
  const tenantRes = isMissingColumnError(tenantWithStart.error?.message, "campaign_start_date")
    ? await supabase
        .from("tenants")
        .select("election_date, campaign_end_date, fundraising_goal")
        .eq("id", tenantId)
        .single()
    : tenantWithStart;
  const tenant = tenantRes.data as {
    election_date?: string | null;
    campaign_end_date?: string | null;
    campaign_start_date?: string | null;
    fundraising_goal?: number | null;
  } | null;

  const [
    { count: volunteers },
    { count: contacts },
    { count: events },
    { count: commentCount },
    { count: pollingUnits },
    { count: incidents },
    { count: pendingComments },
    { count: misinfoOpen },
    { count: flaggedComments },
    { count: volunteersTrained },
    { count: upcomingEvents },
    { count: assignedPus },
    { count: undecidedContacts },
    { count: strongSupporters },
  ] = await Promise.all([
    supabase.from("volunteers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("campaign_events").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    applyCampaignStateFilter(
      supabase.from("polling_units").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    supabase.from("incident_reports").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_misinformation", true)
      .neq("status", "resolved"),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "flagged"),
    supabase
      .from("volunteers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("training_status", "completed"),
    supabase
      .from("campaign_events")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("starts_at", new Date().toISOString()),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("assigned_agent_id", "is", null)
    ),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("support_level", "undecided"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("support_level", ["strong", "leaning"]),
  ]);

  // Trend, ward pressure and hot issues are deliberately computed over the most
  // recent slice rather than all history. `.limit(2000)` alone silently returned
  // 1000, so page through to actually get the window the analysis assumes.
  const COMMENT_WINDOW = 2000;
  const commentRows = await fetchAllRows<{
    sentiment: string | null;
    issue_topic: string | null;
    is_misinformation: boolean | null;
    created_at: string | null;
    ward: string | null;
    status: string | null;
  }>(
    (from, to) =>
      supabase
        .from("comments")
        .select("sentiment, issue_topic, is_misinformation, created_at, ward, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, to),
    { max: COMMENT_WINDOW }
  );

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const issueMap = new Map<string, { total: number; negative: number }>();
  const byDay = new Map<string, { positive: number; negative: number; neutral: number }>();
  const byWard = new Map<string, { positive: number; negative: number; neutral: number }>();

  for (const c of commentRows) {
    if (c.sentiment && c.sentiment in sentiment) {
      sentiment[c.sentiment as keyof typeof sentiment]++;
    }
    const topic = (c.issue_topic ?? "other").replace(/_/g, " ");
    const issue = issueMap.get(topic) ?? { total: 0, negative: 0 };
    issue.total++;
    if (c.sentiment === "negative") issue.negative++;
    issueMap.set(topic, issue);

    const day = c.created_at?.slice(0, 10) ?? "unknown";
    const dayRow = byDay.get(day) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") dayRow.positive++;
    else if (c.sentiment === "negative") dayRow.negative++;
    else dayRow.neutral++;
    byDay.set(day, dayRow);

    const ward = c.ward?.trim() || "Unknown";
    const wardRow = byWard.get(ward) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") wardRow.positive++;
    else if (c.sentiment === "negative") wardRow.negative++;
    else wardRow.neutral++;
    byWard.set(ward, wardRow);
  }

  const classified = sentiment.positive + sentiment.neutral + sentiment.negative;
  const sentimentScore = pct(sentiment.positive, classified || 1);
  const negativeShare = pct(sentiment.negative, classified || 1);

  const sentimentTrend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => ({ date, ...v }));

  const last7 = sentimentTrend.slice(-7);
  const prev7 = sentimentTrend.slice(-14, -7);
  const sumNeg = (rows: { negative: number }[]) => rows.reduce((s, r) => s + r.negative, 0);
  const recentNegativeDelta = sumNeg(last7) - sumNeg(prev7);

  const hotIssues: HotIssue[] = [...issueMap.entries()]
    .map(([topic, v]) => ({
      topic,
      total: v.total,
      negative: v.negative,
      pressure: v.negative * 2 + v.total,
    }))
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, 8);

  const pressureWards: PressureWard[] = [...byWard.entries()]
    .map(([ward, v]) => {
      const total = v.positive + v.neutral + v.negative;
      return {
        ward,
        negative: v.negative,
        total,
        negativePct: pct(v.negative, total || 1),
      };
    })
    .filter((w) => w.ward !== "Unknown" && w.total >= 2)
    .sort((a, b) => b.negativePct - a.negativePct || b.negative - a.negative)
    .slice(0, 8);

  const gapQuery = await applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select("code, name, ward, lga, registered_voters, risk_level")
      .eq("tenant_id", tenantId)
      .is("assigned_agent_id", null)
      .order("registered_voters", { ascending: false })
      .limit(40)
  );
  const uncovered = (gapQuery.data ?? []) as CoverageGap[];
  const coverageGaps = uncovered.slice(0, 10);
  const uncoveredHighRiskPus = uncovered.filter((p) =>
    ["high", "critical"].includes(String(p.risk_level ?? "").toLowerCase())
  ).length;
  const uncoveredHighVoterPus = uncovered.filter((p) => Number(p.registered_voters ?? 0) >= 500).length;

  // Bucketed in SQL. Reducing fetched rows here flattened the trend once a
  // workspace passed PostgREST's 1000-row response cap.
  const monthlyDonations = await supabase.rpc("donation_monthly_totals", {
    p_tenant_id: tenantId,
    p_months: 12,
  });
  let donationTrend: { month: string; amount: number }[] = Array.isArray(monthlyDonations.data)
    ? monthlyDonations.data.map((row: { month?: string; amount?: number | string }) => ({
        month: String(row.month ?? "unknown"),
        amount: Number(row.amount ?? 0),
      }))
    : [];

  if (monthlyDonations.error) {
    const donations = await fetchAllRows<{ amount: number | null; created_at: string | null }>(
      (from, to) =>
        supabase
          .from("donations")
          .select("amount, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at")
          .range(from, to),
      { max: 20_000 }
    );
    const donationByMonth = new Map<string, number>();
    for (const d of donations) {
      const key = (d.created_at ?? "").slice(0, 7) || "unknown";
      donationByMonth.set(key, (donationByMonth.get(key) ?? 0) + Number(d.amount ?? 0));
    }
    donationTrend = [...donationByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }));
  }

  const rpcWards = await supabase.rpc("top_polling_wards", { p_limit: 8 });
  const geographic = Array.isArray(rpcWards.data)
    ? rpcWards.data.map((row: { ward?: string; voters?: number }) => ({
        ward: row.ward ?? "Unknown",
        voters: Number(row.voters ?? 0),
      }))
    : [];

  const metricsRes = await supabase.rpc("dashboard_metrics", { p_tenant_id: tenantId });
  const metrics = (metricsRes.error ? null : metricsRes.data) as
    | { likes?: number; shares?: number; post_comments?: number; posts?: number }
    | null;

  let socialEngagement =
    Number(metrics?.likes ?? 0) + Number(metrics?.shares ?? 0) + Number(metrics?.post_comments ?? 0);
  let postCount = Number(metrics?.posts ?? 0);

  if (!metrics) {
    const posts = await fetchAllRows<{ likes: number | null; comments_count: number | null; shares: number | null }>(
      (from, to) =>
        supabase
          .from("social_posts")
          .select("likes, comments_count, shares")
          .eq("tenant_id", tenantId)
          .range(from, to),
      { max: 20_000 }
    );
    socialEngagement = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments_count ?? 0) + (p.shares ?? 0), 0);
    postCount = posts.length;
  }

  let aiInsight = "";
  let recommendations: string[] = [];
  try {
    // Sentiment shares come from the sampled rows, but the headline counts are
    // the workspace-wide ones so the summary sentence cannot understate them.
    const sampled = totalsFromComments(commentRows);
    const briefing = briefingFromTotals(
      {
        ...sampled,
        total: commentCount ?? sampled.total,
        misinformation: misinfoOpen ?? sampled.misinformation,
      },
      postCount,
      socialEngagement
    );
    aiInsight = briefing.summary;
    recommendations = briefing.recommendations;
  } catch {
    aiInsight = "Sync comments to generate campaign insights.";
  }

  const daysToElection = daysUntil(tenant?.election_date);
  const daysToCampaignEnd = daysUntil(tenant?.campaign_end_date);
  const pusTotal = pollingUnits ?? 0;
  const agentsAssigned = assignedPus ?? 0;
  const agentCoveragePct = pct(agentsAssigned, pusTotal || 1);
  const volunteersTotal = volunteers ?? 0;
  const trained = volunteersTrained ?? 0;
  const volunteersTrainedPct = pct(trained, volunteersTotal || 1);

  const calls: DecisionCall[] = buildDecisionCalls({
    daysToElection,
    pendingComments: pendingComments ?? 0,
    misinfoOpen: misinfoOpen ?? 0,
    flaggedComments: flaggedComments ?? 0,
    sentimentScore,
    negativeShare,
    recentNegativeDelta,
    agentCoveragePct,
    uncoveredHighRiskPus,
    uncoveredHighVoterPus,
    volunteersTrainedPct,
    undecidedContacts: undecidedContacts ?? 0,
    totalContacts: contacts ?? 0,
    upcomingEvents: upcomingEvents ?? 0,
    hotIssue: hotIssues[0] ?? null,
    pressureWard: pressureWards[0] ?? null,
  });

  return {
    volunteers: volunteersTotal,
    contacts: contacts ?? 0,
    events: events ?? 0,
    comments: commentCount ?? 0,
    pollingUnits: pusTotal,
    incidents: incidents ?? 0,
    sentiment,
    donationTrend,
    geographic,
    socialEngagement,
    aiInsight,
    recommendations,
    daysToElection,
    daysToCampaignEnd,
    electionDate: tenant?.election_date ?? null,
    fundraisingGoal: Number(tenant?.fundraising_goal ?? 0),
    kpis: {
      sentimentScore,
      pendingComments: pendingComments ?? 0,
      misinfoOpen: misinfoOpen ?? 0,
      agentCoveragePct,
      uncoveredHighRiskPus,
      volunteersTrainedPct,
      undecidedContacts: undecidedContacts ?? 0,
      upcomingEvents: upcomingEvents ?? 0,
      strongSupporters: strongSupporters ?? 0,
    },
    calls,
    hotIssues,
    pressureWards,
    coverageGaps,
    sentimentTrend,
    groundGame: {
      volunteersTotal,
      volunteersTrained: trained,
      volunteersPending: Math.max(0, volunteersTotal - trained),
      agentsAssignedPus: agentsAssigned,
      pusTotal,
      supporters: strongSupporters ?? 0,
      undecided: undecidedContacts ?? 0,
    },
  };
}
