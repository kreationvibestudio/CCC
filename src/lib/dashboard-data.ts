import { createClient } from "@/lib/supabase/server";
import { generateBriefingFromComments } from "@/lib/ai/briefing";
import { isMissingColumnError } from "@/lib/public-error";

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
    volunteersRes,
    contactsRes,
    puRes,
    eventsRes,
    donationsRes,
    commentsRes,
    socialAccountsRes,
    socialPostsRes,
    activitiesRes,
    briefingRes,
    coordinatorsRes,
  ] = await Promise.all([
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("campaign_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("donations").select("amount").eq("tenant_id", tenantId),
    supabase.from("comments").select("id, sentiment, status, issue_topic, is_misinformation, content").eq("tenant_id", tenantId),
    supabase.from("social_accounts").select("followers").eq("tenant_id", tenantId),
    supabase.from("social_posts").select("likes, shares, comments_count, posted_at, engagement_rate").eq("tenant_id", tenantId).order("posted_at", { ascending: false }).limit(10),
    supabase.from("activities").select("id, action, description, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8),
    supabase.from("ai_briefings").select("content").eq("tenant_id", tenantId).order("briefing_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("role", ["ward_coordinator", "volunteer_coordinator", "polling_unit_supervisor"]),
  ]);

  const donations = donationsRes.data?.reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;
  const followers = socialAccountsRes.data?.reduce((sum, a) => sum + (a.followers ?? 0), 0) ?? 0;
  const posts = socialPostsRes.data ?? [];
  const comments = commentsRes.data ?? [];

  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares ?? 0), 0);
  const totalCommentCount = posts.reduce((s, p) => s + (p.comments_count ?? 0), 0);
  const dailyReach = posts.length
    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments_count ?? 0) + (p.shares ?? 0), 0) / posts.length)
    : 0;

  const positive = comments.filter((c) => c.sentiment === "positive").length;
  const sentimentScore = comments.length ? Math.round((positive / comments.length) * 100) : 0;
  const pendingComments = comments.filter((c) => c.status === "pending").length;

  const issueCounts: Record<string, number> = {};
  for (const c of comments) {
    const t = c.issue_topic ?? "other";
    issueCounts[t] = (issueCounts[t] ?? 0) + 1;
  }
  const issueBreakdown = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic: topic.charAt(0).toUpperCase() + topic.slice(1), count }));

  const engagementTrend = posts.slice(0, 7).reverse().map((p, i) => ({
    label: p.posted_at
      ? new Date(p.posted_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" })
      : `Post ${i + 1}`,
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
    shares: p.shares ?? 0,
  }));

  const briefingContent = briefingRes.data?.content as Record<string, unknown> | undefined;
  const liveBriefing = generateBriefingFromComments(comments, posts.length, totalLikes);
  const hasLiveActivity = comments.length > 0 || posts.length > 0;

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
          sentimentBreakdown: comments.length
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
      socialEngagement: followers,
      dailyReach,
      donations,
      fundraisingGoal: Number(tenant?.fundraising_goal ?? 0),
      sentimentScore,
      voterContacts: comments.length,
      pendingComments,
      totalPosts: posts.length,
      totalLikes,
      totalComments: comments.length || totalCommentCount,
      totalShares,
    },
    activities: activitiesRes.data ?? [],
    briefing,
    engagementTrend,
    issueBreakdown,
  };
}
