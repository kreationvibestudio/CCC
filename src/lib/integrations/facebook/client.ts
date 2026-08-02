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

export const FACEBOOK_PERMISSION_HELP = `Facebook token is missing required permissions. Fix:
1. Go to developers.facebook.com → your app → Tools → Graph API Explorer
2. Select your app "campaign commander center"
3. Click "Generate Access Token" and add these permissions:
   • pages_show_list
   • pages_read_engagement
   • pages_read_user_content
4. Log in with the Facebook account that manages your page
5. Copy the new token into .env.local as FACEBOOK_USER_ACCESS_TOKEN
6. Restart npm run dev`;

function wrapFacebookError(error: { message: string; code?: number; type?: string }): FacebookApiError {
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

async function graphGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const json = await res.json();

  if (json.error) {
    throw wrapFacebookError(json.error);
  }

  return json as T;
}

/** Exchange user token → page token. Skips /me/accounts if token is already a page token. */
export async function resolvePageAccessToken(
  userOrPageToken: string,
  pageId: string
): Promise<string> {
  // 1. If already a page token, /me/accounts will fail — verify via posts endpoint first
  try {
    await graphGet<{ data: unknown[] }>(`/${pageId}/published_posts`, userOrPageToken, {
      fields: "id",
      limit: "1",
    });
    return userOrPageToken;
  } catch (err) {
    if (err instanceof FacebookApiError && err.code !== 10 && err.code !== 210 && err.code !== 100) {
      throw err;
    }
  }

  // 2. User token → exchange via /me/accounts
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
      if (result.data?.length) return result.data;
    } catch (err) {
      if (err instanceof FacebookApiError && err.code !== 10 && err.code !== 210) {
        throw err;
      }
    }
  }

  throw new FacebookApiError(
    `Could not fetch posts. ${FACEBOOK_PERMISSION_HELP}`
  );
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
