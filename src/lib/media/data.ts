import { createClient } from "@/lib/supabase/server";
import { totalsFromComments } from "@/lib/ai/briefing";
import { getCommentsWithResponses, getTeamMembers } from "@/lib/comments/data";
import { getSentimentData } from "@/lib/sentiment/data";
import { getSocialPosts } from "@/lib/social/data";
import { buildMediaBrief, type MediaBrief, type MediaPostSnapshot } from "@/lib/media/brief";
import { decisionInputFromComments, mediaDecisionCalls } from "@/lib/media/decisions";
import { isMissingRelationError } from "@/lib/public-error";
import type { Comment, MediaContent } from "@/types/database";
import type { DecisionCall } from "@/lib/analytics/decisions";
import type { TeamMember } from "@/lib/comments/data";

export type MediaSocialPost = MediaPostSnapshot & {
  platform: string;
};

export type MediaCommandData = {
  mustAct: Comment[];
  lastPosts: MediaSocialPost[];
  issueHeat: { topic: string; count: number }[];
  calls: DecisionCall[];
  items: MediaContent[];
  brief: MediaBrief;
  team: TeamMember[];
  topIssue: string | null;
  schemaMissing: boolean;
};

function asMediaPost(row: {
  id: string;
  content?: string | null;
  likes?: number | null;
  comments_count?: number | null;
  shares?: number | null;
  engagement_rate?: number | null;
  posted_at?: string | null;
  platform?: string | null;
}): MediaSocialPost {
  return {
    id: row.id,
    content: row.content ?? "",
    likes: row.likes ?? 0,
    comments_count: row.comments_count ?? 0,
    shares: row.shares ?? 0,
    engagement_rate: Number(row.engagement_rate ?? 0) || 0,
    posted_at: row.posted_at ?? null,
    platform: row.platform ?? "facebook",
  };
}

function asMediaContent(row: Record<string, unknown>): MediaContent {
  const points = Array.isArray(row.talking_points)
    ? row.talking_points.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    issue_topic: (row.issue_topic as MediaContent["issue_topic"]) ?? null,
    platform: (row.platform as MediaContent["platform"]) ?? "facebook",
    status: (row.status as MediaContent["status"]) ?? "draft",
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    posted_at: (row.posted_at as string | null) ?? null,
    social_post_id: (row.social_post_id as string | null) ?? null,
    talking_points: points,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getMediaContent(tenantId: string): Promise<
  { items: MediaContent[]; schemaMissing: boolean }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_content")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingRelationError(error.message, "media_content")) {
      return { items: [], schemaMissing: true };
    }
    return { items: [], schemaMissing: false };
  }

  return { items: (data ?? []).map((row) => asMediaContent(row as Record<string, unknown>)), schemaMissing: false };
}

export async function getMediaCommandData(tenantId: string): Promise<MediaCommandData> {
  const [comments, postsRaw, sentiment, calendar, team] = await Promise.all([
    getCommentsWithResponses(tenantId),
    getSocialPosts(tenantId, "facebook"),
    getSentimentData(tenantId),
    getMediaContent(tenantId),
    getTeamMembers(tenantId),
  ]);

  const lastPosts = (postsRaw as Array<Parameters<typeof asMediaPost>[0]>).map(asMediaPost).slice(0, 5);
  const allPosts = (postsRaw as Array<Parameters<typeof asMediaPost>[0]>).map(asMediaPost);

  const mustAct = comments
    .filter(
      (comment) =>
        comment.status === "pending" || comment.status === "flagged" || comment.is_misinformation
    )
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);

  const input = decisionInputFromComments(comments);
  const calls = mediaDecisionCalls(input);
  const totals = totalsFromComments(comments);
  const brief = buildMediaBrief({
    totals,
    pending: input.pendingComments,
    flagged: input.flaggedComments,
    misinfo: input.misinfoOpen,
    posts: allPosts,
  });

  const topIssue =
    brief.topIssues[0] ??
    sentiment.issueBreakdown[0]?.topic.replace(/\s+/g, "_").toLowerCase() ??
    null;

  return {
    mustAct,
    lastPosts,
    issueHeat: sentiment.issueBreakdown.slice(0, 6),
    calls,
    items: calendar.items,
    brief,
    team,
    topIssue,
    schemaMissing: calendar.schemaMissing,
  };
}
