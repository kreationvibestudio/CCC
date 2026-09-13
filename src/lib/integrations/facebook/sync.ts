import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { analyzeCommentText } from "@/lib/ai/analyze-comment";
import {
  fetchCommentAuthorsByIds,
  fetchPageInfo,
  fetchPostComments,
  fetchPosts,
  getWorkingPageToken,
  isUsableFacebookToken,
  normalizeTokenFromSetting,
  type FacebookSyncResult,
  FacebookApiError,
} from "./client";
import { isSocialDemoModeEnabled, seedDemoSocialData, shouldAttemptLiveFacebookSync } from "./demo";
import {
  isPlaceholderFacebookAuthor,
  resolveFacebookCommentAuthor,
} from "./comment-author";

const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

function settingString(value: unknown) {
  return normalizeTokenFromSetting(value);
}

async function getFacebookConfig(tenantId: string) {
  let pageId = "";
  let userToken = "";
  let pageToken = "";

  const supabase = await getDbClient();

  const [{ data: settings }, { data: account }] = await Promise.all([
    supabase
      .from("tenant_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["facebook_page_id", "facebook_page_access_token", "facebook_user_access_token"]),
    supabase
      .from("social_accounts")
      .select("account_id, access_token_encrypted")
      .eq("tenant_id", tenantId)
      .eq("platform", "facebook")
      .neq("account_id", "demo-hon-akhakon")
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const row of settings ?? []) {
    const v = settingString(row.value);
    if (row.key === "facebook_page_id") pageId = v;
    if (row.key === "facebook_page_access_token") pageToken = v;
    if (row.key === "facebook_user_access_token") userToken = v;
  }

  pageId = pageId || account?.account_id?.trim() || process.env.FACEBOOK_PAGE_ID?.trim() || "";
  // Prefer TEXT token on social_accounts over JSONB tenant_settings
  const stored = account?.access_token_encrypted?.trim() ?? "";
  if (isUsableFacebookToken(stored)) {
    pageToken = stored;
  }
  userToken = userToken || process.env.FACEBOOK_USER_ACCESS_TOKEN?.trim() || "";
  if (!isUsableFacebookToken(pageToken)) {
    pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
  }

  if (!pageId || pageId.length < 5 || /^your[_-]/i.test(pageId) || pageId === "[SENSITIVE]") {
    throw new FacebookApiError(
      "Facebook page ID is missing. Paste it under Page posts → Connect Facebook (or set FACEBOOK_PAGE_ID)."
    );
  }

  if (!isUsableFacebookToken(userToken) && !isUsableFacebookToken(pageToken)) {
    throw new FacebookApiError(
      "Facebook page token is missing or expired. Paste a never-expiring page token under Page posts → Connect Facebook."
    );
  }

  return { pageId, userToken, pageToken, storedPageToken: stored || null };
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

export async function syncFacebookToDatabase(
  tenantId: string,
  opts?: { validatedPageToken?: string; validatedPageId?: string }
): Promise<FacebookSyncResult> {
  let hasTenantTokens = false;
  try {
    const cfg = await getFacebookConfig(tenantId);
    hasTenantTokens =
      isUsableFacebookToken(opts?.validatedPageToken) ||
      isUsableFacebookToken(cfg.pageToken) ||
      isUsableFacebookToken(cfg.userToken);
  } catch {
    hasTenantTokens = isUsableFacebookToken(opts?.validatedPageToken);
  }

  const preferLive = hasTenantTokens || shouldAttemptLiveFacebookSync();

  if (!preferLive && isSocialDemoModeEnabled()) {
    return seedDemoSocialData(tenantId);
  }

  try {
    return await syncFacebookLive(tenantId, opts);
  } catch (err) {
    if (!preferLive && isSocialDemoModeEnabled()) {
      return seedDemoSocialData(tenantId);
    }
    throw err;
  }
}

async function syncFacebookLive(
  tenantId: string,
  opts?: { validatedPageToken?: string; validatedPageId?: string }
): Promise<FacebookSyncResult> {
  const config = await getFacebookConfig(tenantId);
  const pageId = opts?.validatedPageId?.trim() || config.pageId;
  const supabase = await getDbClient();

  const { data: existingAccount } = await supabase
    .from("social_accounts")
    .select("id, access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .eq("account_id", pageId)
    .maybeSingle();

  let pageToken = opts?.validatedPageToken?.trim() ?? "";
  let tokenSource = "validated_page_token";
  if (!isUsableFacebookToken(pageToken)) {
    const resolved = await getWorkingPageToken({
      pageId,
      envPageToken: config.pageToken,
      envUserToken: config.userToken,
      storedPageToken: existingAccount?.access_token_encrypted ?? config.storedPageToken,
    });
    pageToken = resolved.pageToken;
    tokenSource = resolved.source;
  }

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
      const comments = await fetchPostComments(post.id, pageToken, { userToken: config.userToken });

      for (const comment of comments) {
        const { data: existingComment } = await supabase
          .from("comments")
          .select("id, author_name, author_avatar")
          .eq("tenant_id", tenantId)
          .eq("platform_comment_id", comment.id)
          .maybeSingle();

        // Fast local analysis during sync (avoid OpenAI timeouts in serverless)
        const analysis = analyzeCommentText(comment.message);
        const author = resolveFacebookCommentAuthor(comment, existingComment?.author_name);
        const commentFields = {
          tenant_id: tenantId,
          platform: "facebook" as const,
          platform_comment_id: comment.id,
          post_id: postDbId,
          author_name: author.authorName,
          author_avatar: author.authorAvatar ?? existingComment?.author_avatar ?? null,
          content: comment.message,
          created_at: comment.created_time,
          ...analysis,
        };

        if (existingComment) {
          const { error } = await supabase
            .from("comments")
            .update(commentFields)
            .eq("id", existingComment.id);
          if (error) throw new FacebookApiError(error.message);
        } else {
          const { error } = await supabase.from("comments").insert({
            ...commentFields,
            status: "pending" as const,
          });
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

  const authors = await refreshStoredFacebookCommentAuthors(tenantId, {
    pageToken,
    userToken: config.userToken,
  });
  if (!commentsSkippedReason && authors.hidden > 0 && authors.updated === 0) {
    commentsSkippedReason =
      `Facebook hid ${authors.hidden} commenter name${authors.hidden === 1 ? "" : "s"}. ` +
      "Meta only returns visitor names after Advanced Access to Business Asset User Profile Access.";
  }

  await supabase.from("activities").insert({
    tenant_id: tenantId,
    action: "facebook.sync",
    description: `Synced ${postsSynced} Facebook posts from ${page.name}`,
    metadata: { postsSynced, commentsSynced, tokenSource, commentFailures, ...authors },
  });

  return {
    page,
    postsSynced,
    commentsSynced,
    commentsSkippedReason,
    tokenSource,
    authorsNamed: authors.updated,
    authorsHidden: authors.hidden,
  };
}

export async function refreshStoredFacebookCommentAuthors(
  tenantId: string,
  tokens?: { pageToken?: string; userToken?: string | null }
): Promise<{ updated: number; hidden: number; checked: number }> {
  const supabase = await getDbClient();
  const { data: rows } = await supabase
    .from("comments")
    .select("id, platform_comment_id, author_name, author_avatar")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .order("created_at", { ascending: false })
    .limit(200);

  const placeholders = (rows ?? []).filter((row) => isPlaceholderFacebookAuthor(row.author_name));
  if (placeholders.length === 0) {
    return { updated: 0, hidden: 0, checked: 0 };
  }

  let pageToken = tokens?.pageToken ?? "";
  let userToken = tokens?.userToken ?? "";
  try {
    if (!isUsableFacebookToken(pageToken) || !isUsableFacebookToken(userToken)) {
      const config = await getFacebookConfig(tenantId);
      userToken = userToken || config.userToken;
      if (!isUsableFacebookToken(pageToken)) {
        const { data: existingAccount } = await supabase
          .from("social_accounts")
          .select("access_token_encrypted")
          .eq("tenant_id", tenantId)
          .eq("platform", "facebook")
          .eq("account_id", config.pageId)
          .maybeSingle();
        const resolved = await getWorkingPageToken({
          pageId: config.pageId,
          envPageToken: config.pageToken,
          envUserToken: config.userToken,
          storedPageToken: existingAccount?.access_token_encrypted ?? config.storedPageToken,
        });
        pageToken = resolved.pageToken;
      }
    }
  } catch {
    return { updated: 0, hidden: placeholders.length, checked: placeholders.length };
  }

  const found = await fetchCommentAuthorsByIds(
    placeholders.map((row) => row.platform_comment_id),
    [pageToken, userToken]
  );

  let updated = 0;
  for (const row of placeholders) {
    const from = found.get(row.platform_comment_id);
    if (!from) continue;
    const author = resolveFacebookCommentAuthor({ from }, row.author_name);
    if (isPlaceholderFacebookAuthor(author.authorName)) continue;
    const { error } = await supabase
      .from("comments")
      .update({
        author_name: author.authorName,
        author_avatar: author.authorAvatar ?? row.author_avatar ?? null,
      })
      .eq("id", row.id);
    if (error) throw new FacebookApiError(error.message);
    updated++;
  }

  return {
    updated,
    hidden: placeholders.length - updated,
    checked: placeholders.length,
  };
}

export async function syncFacebookForCampaignTenant() {
  return syncFacebookToDatabase(DEFAULT_TENANT_ID);
}

export async function syncFacebookForConfiguredTenants(): Promise<
  Array<{ tenantId: string; error: string } | ({ tenantId: string } & FacebookSyncResult)>
> {
  const supabase = await getDbClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("tenant_id, key")
    .in("key", ["facebook_page_id", "facebook_page_access_token"]);
  const ids = new Set((settings ?? []).map((s) => s.tenant_id as string));
  ids.add(DEFAULT_TENANT_ID);
  const results = [];
  for (const tenantId of ids) {
    try {
      results.push({ tenantId, ...(await syncFacebookToDatabase(tenantId)) });
    } catch (err) {
      results.push({
        tenantId,
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }
  return results;
}
