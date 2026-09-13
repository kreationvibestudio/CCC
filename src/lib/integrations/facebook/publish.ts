const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type FacebookPublishResult =
  | { ok: true; id: string }
  | { ok: false; error: string; permission?: boolean };

/** Optional page-feed publish. Permission errors must not fail the draft. */
export async function publishFacebookPagePost(
  pageId: string,
  pageToken: string,
  message: string
): Promise<FacebookPublishResult> {
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: pageToken }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; code?: number };
  };

  if (json.error?.message) {
    const messageText = json.error.message;
    const permission =
      json.error.code === 10 ||
      json.error.code === 200 ||
      json.error.code === 294 ||
      /permission|pages_manage_posts|publish/i.test(messageText);
    return { ok: false, error: messageText, permission };
  }

  if (!json.id) return { ok: false, error: "Facebook did not return a post id" };
  return { ok: true, id: json.id };
}
