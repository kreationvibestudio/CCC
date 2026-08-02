import { createClient } from "@/lib/supabase/server";
import { analyzeCommentWithAI } from "@/lib/ai/analyze-comment";
import {
  fetchPageInfo,
  fetchPostComments,
  fetchPosts,
  resolvePageAccessToken,
  type FacebookSyncResult,
  FacebookApiError,
} from "./client";

const DEMO_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

function getFacebookConfig() {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const userToken = process.env.FACEBOOK_USER_ACCESS_TOKEN;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || (!userToken && !pageToken)) {
    throw new FacebookApiError(
      "Facebook is not configured. Add FACEBOOK_PAGE_ID and FACEBOOK_USER_ACCESS_TOKEN to .env.local"
    );
  }

  return { pageId, userToken, pageToken };
}

function calcEngagementRate(likes: number, comments: number, shares: number, followers: number) {
  if (!followers) return 0;
  return Number((((likes + comments + shares) / followers) * 100).toFixed(2));
}

export async function syncFacebookToDatabase(tenantId: string): Promise<FacebookSyncResult> {
  const { pageId, userToken, pageToken: envPageToken } = getFacebookConfig();
  const supabase = await createClient();

  // Use page token directly if available — never call /me/accounts with a page token
  const pageToken = envPageToken
    ?? (userToken ? await resolvePageAccessToken(userToken, pageId) : null);

  if (!pageToken) {
    throw new FacebookApiError("No valid Facebook token. Set FACEBOOK_USER_ACCESS_TOKEN or FACEBOOK_PAGE_ACCESS_TOKEN.");
  }
  const page = await fetchPageInfo(pageId, pageToken);
  const posts = await fetchPosts(pageId, pageToken, 25);
  const followers = page.followers_count ?? page.fan_count ?? 0;

  // Upsert social account
  const { data: existingAccount } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .eq("account_id", pageId)
    .maybeSingle();

  let accountId = existingAccount?.id;

  if (accountId) {
    await supabase
      .from("social_accounts")
      .update({
        account_name: page.name,
        is_connected: true,
        followers,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", accountId);
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
      })
      .select("id")
      .single();

    if (error) throw new FacebookApiError(error.message);
    accountId = inserted.id;
  }

  let postsSynced = 0;
  let commentsSynced = 0;
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
      await supabase.from("social_posts").update(postPayload).eq("id", postDbId);
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

    // Try to fetch comments (requires pages_read_user_content permission)
    if (!commentsSkippedReason) {
      try {
        const comments = await fetchPostComments(post.id, pageToken);

        for (const comment of comments) {
          const { data: existingComment } = await supabase
            .from("comments")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("platform_comment_id", comment.id)
            .maybeSingle();

          const analysis = await analyzeCommentWithAI(comment.message);
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
            await supabase.from("comments").update(commentPayload).eq("id", existingComment.id);
          } else {
            await supabase.from("comments").insert(commentPayload);
          }
          commentsSynced++;
        }
      } catch (err) {
        if (err instanceof FacebookApiError) {
          commentsSkippedReason =
            "Comments require the pages_read_user_content permission. Posts synced successfully. Re-authorize your token in Meta Developer Console with that permission to sync comments.";
        }
      }
    }
  }

  await supabase.from("activities").insert({
    tenant_id: tenantId,
    action: "facebook.sync",
    description: `Synced ${postsSynced} Facebook posts from ${page.name}`,
    metadata: { postsSynced, commentsSynced },
  });

  return { page, postsSynced, commentsSynced, commentsSkippedReason };
}

export async function syncFacebookForDemoTenant() {
  return syncFacebookToDatabase(DEMO_TENANT_ID);
}
