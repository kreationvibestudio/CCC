const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface FacebookPageInfo {
  id: string;
  name: string;
  followers_count?: number;
  fan_count?: number;
  picture?: { data?: { url?: string } };
}

export interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

export interface FacebookComment {
  id: string;
  message: string;
  created_time: string;
  from?: { name?: string; id?: string; picture?: { data?: { url?: string } } };
}

export interface FacebookSyncResult {
  page: FacebookPageInfo;
  postsSynced: number;
  commentsSynced: number;
  commentsSkippedReason?: string;
  tokenSource?: string;
}

export class FacebookApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public type?: string,
    public helpUrl?: string
  ) {
    super(message);
    this.name = "FacebookApiError";
  }
}

export const FACEBOOK_TOKEN_REFRESH_HELP = `Facebook access token expired or invalid. Fix:
1. Go to developers.facebook.com/tools/explorer/
2. Select app "campaign commander center"
3. Add permissions: pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_engagement
4. Generate Access Token → log in as the page admin
5. Exchange for a long-lived page token (see FACEBOOK-SETUP.md) — page tokens from a long-lived user token do not expire
6. Update FACEBOOK_USER_ACCESS_TOKEN and FACEBOOK_PAGE_ACCESS_TOKEN in Vercel + .env.local
7. Optionally set FACEBOOK_APP_ID + FACEBOOK_APP_SECRET so CCC can auto-refresh user tokens
8. Redeploy / restart, then sync again`;

export const FACEBOOK_PERMISSION_HELP = `Facebook token is missing required permissions. Fix:
1. Go to developers.facebook.com → your app → Tools → Graph API Explorer
2. Select your app "campaign commander center"
3. Click "Generate Access Token" and add these permissions:
   • pages_show_list
   • pages_read_engagement
   • pages_read_user_content
4. Log in with the Facebook account that manages your page
5. Copy the new token into .env.local / Vercel as FACEBOOK_USER_ACCESS_TOKEN
6. Restart / redeploy`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isFacebookAuthError(err: unknown): boolean {
  if (!(err instanceof FacebookApiError)) return false;
  return (
    err.code === 190 ||
    err.code === 102 ||
    /session has expired|invalid oauth|cannot parse access token|expired/i.test(err.message)
  );
}

export function isUsableFacebookToken(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 40) return false;
  if (/^\[SENSITIVE\]$/i.test(trimmed)) return false;
  if (/^your[_-]/i.test(trimmed)) return false;
  return true;
}

function wrapFacebookError(error: {
  message: string;
  code?: number;
  type?: string;
  error_subcode?: number;
}): FacebookApiError {
  if (error.code === 190 || /session has expired|invalid oauth|cannot parse access token/i.test(error.message)) {
    return new FacebookApiError(
      `${error.message}\n\n${FACEBOOK_TOKEN_REFRESH_HELP}`,
      error.code,
      error.type,
      "https://developers.facebook.com/tools/explorer/"
    );
  }
  if (error.code === 10 || error.code === 210) {
    return new FacebookApiError(
      `${error.message}\n\n${FACEBOOK_PERMISSION_HELP}`,
      error.code,
      error.type,
      "https://developers.facebook.com/tools/explorer/"
    );
  }
  return new FacebookApiError(error.message, error.code, error.type);
}

async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
      url.searchParams.set("access_token", accessToken);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();

      if (json.error) {
        const err = wrapFacebookError(json.error);
        // Retry transient / rate-limit style failures
        if (
          !isFacebookAuthError(err) &&
          err.code !== 10 &&
          err.code !== 210 &&
          attempt < retries - 1
        ) {
          await sleep(400 * (attempt + 1));
          lastError = err;
          continue;
        }
        throw err;
      }

      return json as T;
    } catch (err) {
      lastError = err;
      if (isFacebookAuthError(err) || attempt === retries - 1) throw err;
      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new FacebookApiError("Facebook request failed");
}

/** Exchange a short-lived user token for a long-lived (~60 day) user token. */
export async function exchangeLongLivedUserToken(shortLivedUserToken: string): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new FacebookApiError(
      "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required to refresh long-lived tokens."
    );
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedUserToken);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw wrapFacebookError(json.error);
  if (!json.access_token) {
    throw new FacebookApiError("Facebook did not return a long-lived user token.");
  }
  return json.access_token as string;
}

async function probePageToken(pageId: string, token: string): Promise<boolean> {
  try {
    await graphGet<{ data: unknown[] }>(`/${pageId}/published_posts`, token, {
      fields: "id",
      limit: "1",
    });
    return true;
  } catch (err) {
    if (isFacebookAuthError(err)) return false;
    // Permission / empty errors still mean the token was accepted
    if (err instanceof FacebookApiError && (err.code === 10 || err.code === 210 || err.code === 100)) {
      return true;
    }
    throw err;
  }
}

/** Exchange user token → page token. Skips /me/accounts if token is already a page token. */
export async function resolvePageAccessToken(
  userOrPageToken: string,
  pageId: string
): Promise<string> {
  if (await probePageToken(pageId, userOrPageToken)) {
    return userOrPageToken;
  }

  try {
    const accounts = await graphGet<{
      data: Array<{ id: string; access_token: string }>;
    }>("/me/accounts", userOrPageToken, { fields: "id,access_token" });

    const page = accounts.data?.find((a) => a.id === pageId);
    if (page?.access_token) {
      return page.access_token;
    }

    if (accounts.data?.length) {
      throw new FacebookApiError(
        `Page ${pageId} not found in your account. Pages available: ${accounts.data.map((a) => a.id).join(", ")}`
      );
    }
  } catch (err) {
    if (err instanceof FacebookApiError && err.code !== 10 && err.code !== 210) {
      throw err;
    }
  }

  throw new FacebookApiError(FACEBOOK_PERMISSION_HELP);
}

/**
 * Try env page token → stored token → refreshed user token → user token exchange.
 * Returns the first working page token.
 */
export async function getWorkingPageToken(options: {
  pageId: string;
  envPageToken?: string | null;
  envUserToken?: string | null;
  storedPageToken?: string | null;
}): Promise<{ pageToken: string; source: string }> {
  const { pageId } = options;
  const candidates: Array<{ token: string; source: string; kind: "page" | "user" }> = [];

  if (isUsableFacebookToken(options.envPageToken)) {
    candidates.push({ token: options.envPageToken, source: "env_page_token", kind: "page" });
  }
  if (isUsableFacebookToken(options.storedPageToken)) {
    candidates.push({ token: options.storedPageToken, source: "stored_page_token", kind: "page" });
  }
  if (isUsableFacebookToken(options.envUserToken)) {
    candidates.push({ token: options.envUserToken, source: "env_user_token", kind: "user" });
  }

  if (candidates.length === 0) {
    throw new FacebookApiError(
      "Facebook is not configured with usable tokens. Set FACEBOOK_PAGE_ACCESS_TOKEN (preferred) or FACEBOOK_USER_ACCESS_TOKEN. Vercel “Sensitive” values cannot be pulled locally — set them in the Vercel dashboard."
    );
  }

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      if (candidate.kind === "page") {
        if (await probePageToken(pageId, candidate.token)) {
          return { pageToken: candidate.token, source: candidate.source };
        }
        errors.push(`${candidate.source}: expired or invalid`);
        continue;
      }

      // User token: optionally upgrade to long-lived, then resolve page token
      let userToken = candidate.token;
      if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
        try {
          userToken = await exchangeLongLivedUserToken(candidate.token);
        } catch (err) {
          // Keep short-lived token if exchange fails
          errors.push(
            `long_lived_exchange: ${err instanceof Error ? err.message.split("\n")[0] : "failed"}`
          );
        }
      }

      const pageToken = await resolvePageAccessToken(userToken, pageId);
      return { pageToken, source: `${candidate.source}->page` };
    } catch (err) {
      errors.push(
        `${candidate.source}: ${err instanceof Error ? err.message.split("\n")[0] : "failed"}`
      );
      if (!isFacebookAuthError(err) && !(err instanceof FacebookApiError && (err.code === 10 || err.code === 210))) {
        // Unexpected non-auth failure on a candidate — keep trying others, but remember it
        continue;
      }
    }
  }

  throw new FacebookApiError(
    `Could not obtain a working Facebook page token.\nTried: ${errors.join(" | ")}\n\n${FACEBOOK_TOKEN_REFRESH_HELP}`
  );
}

export async function fetchPageInfo(pageId: string, pageToken: string): Promise<FacebookPageInfo> {
  return graphGet<FacebookPageInfo>(`/${pageId}`, pageToken, {
    fields: "id,name,followers_count,fan_count,picture",
  });
}

export async function fetchPosts(pageId: string, pageToken: string, limit = 25): Promise<FacebookPost[]> {
  const fullFields = [
    "id", "message", "created_time", "full_picture",
    "likes.summary(true)", "comments.summary(true)", "shares",
  ].join(",");

  const basicFields = "id,message,created_time,full_picture";
  let sawAuthError: FacebookApiError | null = null;

  for (const [endpoint, fields] of [
    ["published_posts", fullFields],
    ["posts", fullFields],
    ["published_posts", basicFields],
    ["posts", basicFields],
  ] as const) {
    try {
      const result = await graphGet<{ data: FacebookPost[] }>(
        `/${pageId}/${endpoint}`,
        pageToken,
        { fields, limit: String(limit) }
      );
      // Empty feed is valid — do not treat as permission failure
      return result.data ?? [];
    } catch (err) {
      if (isFacebookAuthError(err)) {
        sawAuthError = err instanceof FacebookApiError ? err : new FacebookApiError(String(err));
        break;
      }
      if (err instanceof FacebookApiError && err.code !== 10 && err.code !== 210) {
        throw err;
      }
    }
  }

  if (sawAuthError) throw sawAuthError;

  throw new FacebookApiError(`Could not fetch posts. ${FACEBOOK_PERMISSION_HELP}`);
}

export async function fetchPostComments(postId: string, pageToken: string): Promise<FacebookComment[]> {
  const result = await graphGet<{ data: FacebookComment[] }>(`/${postId}/comments`, pageToken, {
    fields: "id,message,created_time,from",
    limit: "100",
  });

  return result.data ?? [];
}

export async function testFacebookConnection(
  userOrPageToken: string,
  pageId: string
): Promise<{ pageToken: string; page: FacebookPageInfo; postCount: number }> {
  const pageToken = await resolvePageAccessToken(userOrPageToken, pageId);
  const page = await fetchPageInfo(pageId, pageToken);
  const posts = await fetchPosts(pageId, pageToken, 3);
  return { pageToken, page, postCount: posts.length };
}
