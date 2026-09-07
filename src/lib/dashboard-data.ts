import { createClient } from "@/lib/supabase/server";
import { briefingFromTotals, totalsFromComments, type CommentTotals } from "@/lib/ai/briefing";
import { isMissingColumnError } from "@/lib/public-error";
import { applyCampaignStateFilter } from "@/lib/polling-units/scope";
import { POSTGREST_MAX_ROWS } from "@/lib/supabase/paginate";

export interface DashboardStats {
  supporters: number;
  volunteers: number;
  coordinators: number;
  pollingUnits: number;
  events: number;
  socialEngagement: number;
  dailyReach: number;
  donations: number;
  fundraisingGoal: number;
  sentimentScore: number;
  voterContacts: number;
  pendingComments: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

export interface DashboardActivity {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

export interface DashboardBriefing {
  summary: string;
  topIssues: string[];
  recommendations: string[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}

export interface DashboardData {
  tenantName: string;
  electionDate: string | null;
  campaignEndDate: string | null;
  campaignStartDate: string | null;
  stats: DashboardStats;
  activities: DashboardActivity[];
  briefing: DashboardBriefing | null;
  engagementTrend: { label: string; likes: number; comments: number; shares: number }[];
  issueBreakdown: { topic: string; count: number }[];
}

/** A stored AI briefing older than this is stale; recompute from live data. */
const BRIEFING_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

type Metrics = {
  donations: number;
  followers: number;
  posts: number;
  likes: number;
  shares: number;
  post_comments: number;
  comments: number;
  sentiment: { positive: number; neutral: number; negative: number };
  pending_comments: number;
  misinformation: number;
  issues: { topic: string; count: number }[];
};

function readMetrics(raw: unknown): Metrics | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const num = (value: unknown) => Number(value ?? 0) || 0;
  const sentiment = (m.sentiment ?? {}) as Record<string, unknown>;
  return {
    donations: num(m.donations),
    followers: num(m.followers),
    posts: num(m.posts),
    likes: num(m.likes),
    shares: num(m.shares),
    post_comments: num(m.post_comments),
    comments: num(m.comments),
    sentiment: {
      positive: num(sentiment.positive),
      neutral: num(sentiment.neutral),
      negative: num(sentiment.negative),
    },
    pending_comments: num(m.pending_comments),
    misinformation: num(m.misinformation),
    issues: Array.isArray(m.issues)
      ? m.issues.map((row) => {
          const entry = (row ?? {}) as Record<string, unknown>;
          return { topic: String(entry.topic ?? "other"), count: num(entry.count) };
        })
      : [],
  };
}

export async function getDashboardData(tenantId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const tenantWithStart = await supabase
    .from("tenants")
    .select("name, election_date, campaign_end_date, campaign_start_date, fundraising_goal")
    .eq("id", tenantId)
    .single();
  const tenantRes = isMissingColumnError(tenantWithStart.error?.message, "campaign_start_date")
    ? await supabase
        .from("tenants")
        .select("name, election_date, campaign_end_date, fundraising_goal")
        .eq("id", tenantId)
        .single()
    : tenantWithStart;
  const tenant = tenantRes.data as {
    name?: string;
    election_date?: string | null;
    campaign_end_date?: string | null;
    campaign_start_date?: string | null;
    fundraising_goal?: number | null;
  } | null;

  const [
    metricsRes,
    volunteersRes,
    contactsRes,
    puRes,
    eventsRes,
    recentPostsRes,
    activitiesRes,
    briefingRes,
    coordinatorsRes,
  ] = await Promise.all([
    // One database round trip for every sum and count. These used to be
    // computed by fetching the rows, which PostgREST truncates at
    // db-max-rows, so any workspace past 1000 donations or comments reported
    // a prefix of its data as the total.
    supabase.rpc("dashboard_metrics", { p_tenant_id: tenantId }),
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    applyCampaignStateFilter(
      supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    supabase.from("campaign_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    // Only the engagement sparkline needs individual posts.
    supabase.from("social_posts").select("likes, shares, comments_count, posted_at").eq("tenant_id", tenantId).order("posted_at", { ascending: false }).limit(10),
    supabase.from("activities").select("id, action, description, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8),
    supabase.from("ai_briefings").select("content, briefing_date").eq("tenant_id", tenantId).order("briefing_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("role", ["ward_coordinator", "volunteer_coordinator", "polling_unit_supervisor"]),
  ]);

  const recentPosts = recentPostsRes.data ?? [];
  let metrics = metricsRes.error ? null : readMetrics(metricsRes.data);
  let commentTotals: CommentTotals;

  if (metrics) {
    commentTotals = {
      total: metrics.comments,
      positive: metrics.sentiment.positive,
      neutral: metrics.sentiment.neutral,
      negative: metrics.sentiment.negative,
      misinformation: metrics.misinformation,
      topIssues: metrics.issues.map((i) => i.topic),
    };
  } else {
    // The RPC ships in a migration; a deploy that lands before it must still
    // render. Capped reads, so a large workspace degrades to approximate
    // figures rather than a blank dashboard.
    const [donationsRes, commentsRes, accountsRes, postsRes] = await Promise.all([
      supabase.from("donations").select("amount").eq("tenant_id", tenantId).limit(POSTGREST_MAX_ROWS),
      supabase.from("comments").select("sentiment, status, issue_topic, is_misinformation").eq("tenant_id", tenantId).limit(POSTGREST_MAX_ROWS),
      supabase.from("social_accounts").select("followers").eq("tenant_id", tenantId).limit(POSTGREST_MAX_ROWS),
      supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]);
    const fallbackComments = commentsRes.data ?? [];
    commentTotals = totalsFromComments(fallbackComments);
    metrics = {
      donations: (donationsRes.data ?? []).reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      followers: (accountsRes.data ?? []).reduce((sum, a) => sum + (a.followers ?? 0), 0),
      posts: postsRes.count ?? recentPosts.length,
      likes: recentPosts.reduce((s, p) => s + (p.likes ?? 0), 0),
      shares: recentPosts.reduce((s, p) => s + (p.shares ?? 0), 0),
      post_comments: recentPosts.reduce((s, p) => s + (p.comments_count ?? 0), 0),
      comments: commentTotals.total,
      sentiment: {
        positive: commentTotals.positive,
        neutral: commentTotals.neutral,
        negative: commentTotals.negative,
      },
      pending_comments: fallbackComments.filter((c) => c.status === "pending").length,
      misinformation: commentTotals.misinformation,
      issues: commentTotals.topIssues.map((topic) => ({ topic, count: 0 })),
    };
  }

  const sentimentScore = metrics.comments
    ? Math.round((metrics.sentiment.positive / metrics.comments) * 100)
    : 0;

  const issueBreakdown = metrics.issues
    .slice(0, 6)
    .map(({ topic, count }) => ({ topic: topic.charAt(0).toUpperCase() + topic.slice(1), count }));

  // Average engagement across the posts on the sparkline, not the whole history:
  // "daily reach" is meant to describe current momentum.
  const dailyReach = recentPosts.length
    ? Math.round(
        recentPosts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments_count ?? 0) + (p.shares ?? 0), 0) /
          recentPosts.length
      )
    : 0;

  const engagementTrend = recentPosts.slice(0, 7).reverse().map((p, i) => ({
    label: p.posted_at
      ? new Date(p.posted_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" })
      : `Post ${i + 1}`,
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
    shares: p.shares ?? 0,
  }));

  // A stored briefing is a snapshot of one day's AI run. Presenting a month-old
  // one under "AI Daily Briefing" put a stale sentiment figure next to the live
  // Sentiment Score tile and the two disagreed, so only recent runs are used.
  const storedDate = briefingRes.data?.briefing_date
    ? Date.parse(String(briefingRes.data.briefing_date))
    : NaN;
  const storedIsFresh =
    Number.isFinite(storedDate) && Date.now() - storedDate <= BRIEFING_MAX_AGE_MS;
  const briefingContent = storedIsFresh
    ? (briefingRes.data?.content as Record<string, unknown> | undefined)
    : undefined;

  const liveBriefing = briefingFromTotals(commentTotals, metrics.posts, metrics.likes);
  const hasLiveActivity = metrics.comments > 0 || metrics.posts > 0;

  const briefing: DashboardBriefing =
    hasLiveActivity && briefingContent
      ? {
          summary: String(briefingContent.summary ?? liveBriefing.summary),
          topIssues: (briefingContent.top_issues as string[])?.length
            ? (briefingContent.top_issues as string[])
            : liveBriefing.topIssues,
          recommendations: (briefingContent.recommendations as string[])?.length
            ? (briefingContent.recommendations as string[])
            : liveBriefing.recommendations,
          sentimentBreakdown: metrics.comments
            ? liveBriefing.sentimentBreakdown
            : (briefingContent.sentiment_breakdown as DashboardBriefing["sentimentBreakdown"]) ??
              liveBriefing.sentimentBreakdown,
        }
      : liveBriefing;

  return {
    tenantName: tenant?.name ?? "Campaign Command Center",
    electionDate: tenant?.election_date ?? null,
    campaignEndDate: tenant?.campaign_end_date ?? null,
    campaignStartDate: tenant?.campaign_start_date ?? null,
    stats: {
      supporters: contactsRes.count ?? 0,
      volunteers: volunteersRes.count ?? 0,
      coordinators: coordinatorsRes.count ?? 0,
      pollingUnits: puRes.count ?? 0,
      events: eventsRes.count ?? 0,
      socialEngagement: metrics.followers,
      dailyReach,
      donations: metrics.donations,
      fundraisingGoal: Number(tenant?.fundraising_goal ?? 0),
      sentimentScore,
      voterContacts: metrics.comments,
      pendingComments: metrics.pending_comments,
      totalPosts: metrics.posts,
      totalLikes: metrics.likes,
      // Inbox comments when there are any, otherwise the count Facebook
      // reports on the posts themselves.
      totalComments: metrics.comments || metrics.post_comments,
      totalShares: metrics.shares,
    },
    activities: activitiesRes.data ?? [],
    briefing,
    engagementTrend,
    issueBreakdown,
  };
}
