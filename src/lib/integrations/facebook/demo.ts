import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { FacebookSyncResult } from "./client";
import { isUsableFacebookToken } from "./client";

const DEMO_PAGE_ID = "demo-hon-akhakon";
const DEMO_PAGE_NAME = "Hon Akhakon Annenih (demo)";

const DEMO_POSTS: {
  id: string;
  content: string;
  likes: number;
  shares: number;
  comments: number;
  daysAgo: number;
}[] = [
  {
    id: "demo_post_rally",
    content:
      "Thank you Esan Central for the warm reception at today's town-hall. Together we will deliver jobs, roads, and accountable representation for every ward.",
    likes: 428,
    shares: 76,
    comments: 3,
    daysAgo: 1,
  },
  {
    id: "demo_post_youth",
    content:
      "Our youth empowerment clinics continue across Edo. Register at your ward office — skills, starter kits, and mentorship for young entrepreneurs.",
    likes: 312,
    shares: 54,
    comments: 2,
    daysAgo: 3,
  },
  {
    id: "demo_post_health",
    content:
      "Primary health centres must work. We are auditing PHCs ward by ward and will publish the findings. Every community deserves dignified care.",
    likes: 501,
    shares: 91,
    comments: 2,
    daysAgo: 5,
  },
  {
    id: "demo_post_thankyou",
    content:
      "Grateful for the support from market women in Uromi and Irrua. Your voices shape this campaign — keep speaking up.",
    likes: 267,
    shares: 33,
    comments: 1,
    daysAgo: 8,
  },
  {
    id: "demo_post_security",
    content:
      "Security is not slogans. We are coordinating with community leaders on early-warning networks ahead of election day. Stay vigilant, stay peaceful.",
    likes: 389,
    shares: 62,
    comments: 2,
    daysAgo: 12,
  },
];

const DEMO_COMMENTS: { postId: string; id: string; message: string; from: string }[] = [
  { postId: "demo_post_rally", id: "c1", message: "We are with you! Esan Central stands ready.", from: "Ada O." },
  { postId: "demo_post_rally", id: "c2", message: "Please visit our ward next — we need the road fixed.", from: "Ibrahim K." },
  { postId: "demo_post_rally", id: "c3", message: "Powerful message. God bless the campaign.", from: "Grace E." },
  { postId: "demo_post_youth", id: "c4", message: "How do youths in Igueben register?", from: "Mike S." },
  { postId: "demo_post_youth", id: "c5", message: "This is what leadership looks like.", from: "Ngozi A." },
  { postId: "demo_post_health", id: "c6", message: "Our PHC has no drugs — please include Ugbegun.", from: "Faith M." },
  { postId: "demo_post_health", id: "c7", message: "Transparency will win trust. Thank you.", from: "Chidi O." },
  { postId: "demo_post_thankyou", id: "c8", message: "Market women are behind this movement!", from: "Blessing T." },
  { postId: "demo_post_security", id: "c9", message: "Peaceful elections only. Count us in.", from: "Samuel D." },
  { postId: "demo_post_security", id: "c10", message: "When is the next community briefing?", from: "Ruth I." },
];

function hasUsableEnvFacebookTokens() {
  return (
    isUsableFacebookToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN) ||
    isUsableFacebookToken(process.env.FACEBOOK_USER_ACCESS_TOKEN)
  );
}

/**
 * Demo only when Meta tokens are missing.
 * SOCIAL_DEMO_MODE=true never overrides live tokens — production must keep syncing Graph.
 * SOCIAL_DEMO_MODE=false disables demo even when tokens are empty (errors instead).
 */
export function isSocialDemoModeEnabled() {
  const flag = process.env.SOCIAL_DEMO_MODE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (hasUsableEnvFacebookTokens()) return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  return true; // no usable tokens → demo for local/dev
}

/** Prefer live Graph whenever any usable token is present (env). */
export function shouldAttemptLiveFacebookSync() {
  return hasUsableEnvFacebookTokens();
}

async function getDbClient() {
  try {
    return createServiceClient();
  } catch {
    return createClient();
  }
}

/** Seed sample social data on a separate demo account — never overwrite live page tokens. */
export async function seedDemoSocialData(tenantId: string): Promise<FacebookSyncResult> {
  const supabase = await getDbClient();
  const now = Date.now();
  const followers = 12840;

  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .eq("account_id", DEMO_PAGE_ID)
    .maybeSingle();

  let accountId = existing?.id as string | undefined;
  if (accountId) {
    const { error } = await supabase
      .from("social_accounts")
      .update({
        account_name: DEMO_PAGE_NAME,
        is_connected: true,
        followers,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", accountId);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("social_accounts")
      .insert({
        tenant_id: tenantId,
        platform: "facebook",
        account_id: DEMO_PAGE_ID,
        account_name: DEMO_PAGE_NAME,
        is_connected: true,
        followers,
        last_synced_at: new Date().toISOString(),
        access_token_encrypted: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    accountId = inserted.id;
  }

  let postsSynced = 0;
  const postIdByDemo: Record<string, string> = {};

  for (const post of DEMO_POSTS) {
    const postedAt = new Date(now - post.daysAgo * 86400000).toISOString();
    const engagement = Number((((post.likes + post.comments + post.shares) / followers) * 100).toFixed(2));
    const { data: existingPost } = await supabase
      .from("social_posts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform", "facebook")
      .eq("platform_post_id", post.id)
      .maybeSingle();

    const postPayload = {
      tenant_id: tenantId,
      account_id: accountId,
      platform: "facebook" as const,
      platform_post_id: post.id,
      content: post.content,
      likes: post.likes,
      shares: post.shares,
      comments_count: post.comments,
      engagement_rate: engagement,
      posted_at: postedAt,
    };

    if (existingPost?.id) {
      const { error } = await supabase.from("social_posts").update(postPayload).eq("id", existingPost.id);
      if (error) throw new Error(error.message);
      postIdByDemo[post.id] = existingPost.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("social_posts")
        .insert(postPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      postIdByDemo[post.id] = inserted.id;
    }
    postsSynced += 1;
  }

  let commentsSynced = 0;
  for (const c of DEMO_COMMENTS) {
    const postDbId = postIdByDemo[c.postId];
    if (!postDbId) continue;
    const platformCommentId = `demo_${c.id}`;
    const { data: existingComment } = await supabase
      .from("comments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform_comment_id", platformCommentId)
      .maybeSingle();

    const payload = {
      tenant_id: tenantId,
      post_id: postDbId,
      platform: "facebook" as const,
      platform_comment_id: platformCommentId,
      author_name: c.from,
      content: c.message,
      sentiment: "neutral" as const,
      status: "pending" as const,
    };

    if (existingComment?.id) {
      const { error } = await supabase.from("comments").update(payload).eq("id", existingComment.id);
      if (error) continue;
    } else {
      const { error } = await supabase.from("comments").insert(payload);
      if (error) continue;
    }
    commentsSynced += 1;
  }

  try {
    await supabase.from("activities").insert({
      tenant_id: tenantId,
      action: "facebook.sync",
      description: `Loaded ${postsSynced} demo posts (Meta page token not configured)`,
      metadata: { postsSynced, commentsSynced, tokenSource: "demo" },
    });
  } catch {
    // optional
  }

  return {
    page: { id: DEMO_PAGE_ID, name: DEMO_PAGE_NAME, followers_count: followers, fan_count: followers },
    postsSynced,
    commentsSynced,
    tokenSource: "demo",
  };
}
