const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function postFacebookCommentReply(
  platformCommentId: string,
  message: string,
  pageToken: string
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_BASE}/${platformCommentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: pageToken }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}
