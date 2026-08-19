import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { analyzeCommentText } from "@/lib/ai/analyze-comment";
import {
  fetchPageInfo,
  fetchPostComments,
  fetchPosts,
  getWorkingPageToken,
  isUsableFacebookToken,
  type FacebookSyncResult,
  FacebookApiError,
} from "./client";

const CAMPAIGN_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

function getFacebookConfig() {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const userToken = process.env.FACEBOOK_USER_ACCESS_TOKEN?.trim();
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();

  if (!pageId || pageId.length < 5 || /^your[_-]/i.test(pageId) || pageId === "[SENSITIVE]") {
    throw new FacebookApiError(
      "FACEBOOK_PAGE_ID is missing or invalid. Set the real page ID in Vercel / .env.local (e.g. 671649942702174)."
    );
  }

  if (!isUsableFacebookToken(userToken) && !isUsableFacebookToken(pageToken)) {
    throw new FacebookApiError(
      "Facebook tokens are missing or invalid. Set FACEBOOK_PAGE_ACCESS_TOKEN (preferred, never-expiring page token) or FACEBOOK_USER_ACCESS_TOKEN. Note: `vercel env pull` redacts Sensitive values as [SENSITIVE] — paste real tokens in the Vercel dashboard."
    );
  }

  return { pageId, userToken, pageToken };
}

function calcEngagementRate(likes: number, comments: number, shares: number, followers: number) {
  if (!followers) return 0;
  return Number((((likes + comments + shares) / followers) * 100).toFixed(2));
}

async function getDbClient() {
  try {
    return createServiceClient();
  } catch {
    return createClient();
  }
}

export async function syncFacebookToDatabase(tenantId: string): Promise<FacebookSyncResult> {
  const { pageId, userToken, pageToken: envPageToken } = getFacebookConfig();
  const supabase = await getDbClient();

  const { data: existingAccount } = await supabase
    .from("social_accounts")
    .select("id, access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .eq("account_id", pageId)
    .maybeSingle();

  const { pageToken, source: tokenSource } = await getWorkingPageToken({
    pageId,
    envPageToken,
    envUserToken: userToken,
    storedPageToken: existingAccount?.access_token_encrypted,
  });

  const page = await fetchPageInfo(pageId, pageToken);
  const posts = await fetchPosts(pageId, pageToken, 25);
  const followers = page.followers_count ?? page.fan_count ?? 0;

  let accountId = existingAccount?.id;

  if (accountId) {
    const { error } = await supabase
      .from("social_accounts")
      .update({
        account_name: page.name,
        is_connected: true,
        followers,
        last_synced_at: new Date().toISOString(),
        access_token_encrypted: pageToken,
      })
      .eq("id", accountId);
    if (error) throw new FacebookApiError(`Failed to update social account: ${error.message}`);
  } else {
    const { data: inserted, error } = await supabase
      .from("social_accounts")
      .insert({
        tenant_id: tenantId,
        platform: "facebook",
        account_name: page.name,
        account_id: pageId,
        is_connected: true,
        followers,
        last_synced_at: new Date().toISOString(),
        access_token_encrypted: pageToken,
      })
      .select("id")
      .single();

    if (error) throw new FacebookApiError(error.message);
    accountId = inserted.id;
  }

  let postsSynced = 0;
  let commentsSynced = 0;
  let commentFailures = 0;
  let skipRemainingComments = false;
  let commentsSkippedReason: string | undefined;

  for (const post of posts) {
    const likes = post.likes?.summary?.total_count ?? 0;
    const commentsCount = post.comments?.summary?.total_count ?? 0;
    const shares = post.shares?.count ?? 0;

    const { data: existingPost } = await supabase
      .from("social_posts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform_post_id", post.id)
      .maybeSingle();

    let postDbId = existingPost?.id;

    const postPayload = {
      tenant_id: tenantId,
      account_id: accountId,
      platform: "facebook" as const,
      platform_post_id: post.id,
      content: post.message ?? "",
      media_url: post.full_picture ?? null,
      likes,
      shares,
      comments_count: commentsCount,
      reach: Math.round(followers * 0.15),
      engagement_rate: calcEngagementRate(likes, commentsCount, shares, followers),
      posted_at: post.created_time,
    };

    if (postDbId) {
      const { error } = await supabase.from("social_posts").update(postPayload).eq("id", postDbId);
      if (error) throw new FacebookApiError(`Failed to update post: ${error.message}`);
    } else {
      const { data: insertedPost, error } = await supabase
        .from("social_posts")
        .insert(postPayload)
        .select("id")
        .single();
      if (error) throw new FacebookApiError(error.message);
      postDbId = insertedPost.id;
    }

    postsSynced++;

    // Keep going per-post — one comment failure must not abort the whole sync
    if (skipRemainingComments) continue;

    try {
      const comments = await fetchPostComments(post.id, pageToken);

      for (const comment of comments) {
        const { data: existingComment } = await supabase
          .from("comments")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("platform_comment_id", comment.id)
          .maybeSingle();

        // Fast local analysis during sync (avoid OpenAI timeouts in serverless)
        const analysis = analyzeCommentText(comment.message);
        const commentPayload = {
          tenant_id: tenantId,
          platform: "facebook" as const,
          platform_comment_id: comment.id,
          post_id: postDbId,
          author_name: comment.from?.name ?? "Facebook User",
          content: comment.message,
          status: "pending" as const,
          created_at: comment.created_time,
          ...analysis,
        };

        if (existingComment) {
          const { error } = await supabase
            .from("comments")
            .update(commentPayload)
            .eq("id", existingComment.id);
          if (error) throw new FacebookApiError(error.message);
        } else {
          const { error } = await supabase.from("comments").insert(commentPayload);
          if (error) throw new FacebookApiError(error.message);
        }
        commentsSynced++;
      }
    } catch (err) {
      commentFailures++;
      const permissionDenied =
        err instanceof FacebookApiError && (err.code === 10 || err.code === 210);

      if (permissionDenied) {
        commentsSkippedReason =
          "Comments require pages_read_user_content. Posts synced successfully. Re-authorize the token with that permission.";
        skipRemainingComments = true;
      } else if (!commentsSkippedReason) {
        commentsSkippedReason =
          err instanceof Error
            ? `Some comments could not be synced: ${err.message.split("\n")[0]}`
            : "Some comments could not be synced.";
      }

      if (commentFailures >= 5) skipRemainingComments = true;
    }
  }

  await supabase.from("activities").insert({
    tenant_id: tenantId,
    action: "facebook.sync",
    description: `Synced ${postsSynced} Facebook posts from ${page.name}`,
    metadata: { postsSynced, commentsSynced, tokenSource, commentFailures },
  });

  return { page, postsSynced, commentsSynced, commentsSkippedReason, tokenSource };
}

export async function syncFacebookForDemoTenant() {
  return syncFacebookToDatabase(CAMPAIGN_TENANT_ID);
}
