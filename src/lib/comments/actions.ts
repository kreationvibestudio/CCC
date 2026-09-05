"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { analyzeCommentWithAI } from "@/lib/ai/analyze-comment";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { postFacebookCommentReply } from "@/lib/integrations/facebook/reply";

export async function updateCommentStatus(
  commentId: string,
  status: "pending" | "assigned" | "replied" | "resolved" | "flagged"
) {
  await requirePermission("comments.moderate");
  const supabase = await createClient();
  const { error } = await supabase.from("comments").update({ status }).eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath("/comments");
  return { success: true };
}

export async function assignComment(commentId: string, userId: string | null) {
  await requirePermission("comments.assign");
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .update({ assigned_to: userId, status: userId ? "assigned" : "pending" })
    .eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath("/comments");
  return { success: true };
}

export async function flagMisinformation(commentId: string) {
  await requirePermission("comments.moderate");
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .update({ is_misinformation: true, status: "flagged", priority_score: 95 })
    .eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath("/comments");
  return { success: true };
}

export async function resolveComment(commentId: string) {
  return updateCommentStatus(commentId, "resolved");
}

export async function replyToComment(commentId: string, replyText: string) {
  const user = await requirePermission("comments.reply");
  const supabase = await createClient();

  const { data: comment } = await supabase
    .from("comments")
    .select("id, platform, platform_comment_id, tenant_id")
    .eq("id", commentId)
    .single();

  if (!comment) return { error: "Comment not found" };

  if (comment.platform === "facebook") {
    const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
    if (!pageId) return { error: "FACEBOOK_PAGE_ID not configured" };

    const { data: account } = await supabase
      .from("social_accounts")
      .select("access_token_encrypted")
      .eq("tenant_id", comment.tenant_id)
      .eq("platform", "facebook")
      .eq("account_id", pageId)
      .maybeSingle();

    try {
      const { getWorkingPageToken } = await import("@/lib/integrations/facebook/client");
      const { pageToken } = await getWorkingPageToken({
        pageId,
        envPageToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        envUserToken: process.env.FACEBOOK_USER_ACCESS_TOKEN,
        storedPageToken: account?.access_token_encrypted,
      });
      await postFacebookCommentReply(comment.platform_comment_id, replyText, pageToken);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Facebook reply failed" };
    }
  }

  await supabase.from("comment_responses").insert({
    comment_id: commentId,
    responder_id: user.id,
    content: replyText,
    is_ai_generated: false,
  });

  await supabase.from("comments").update({ status: "replied" }).eq("id", commentId);

  await supabase.from("activities").insert({
    tenant_id: comment.tenant_id,
    user_id: user.id,
    action: "comment.replied",
    description: `Replied to comment on ${comment.platform}`,
  });

  revalidatePath("/comments");
  return { success: true };
}

export async function classifyComment(commentId: string) {
  await requirePermission("comments.view");
  const supabase = await createClient();
  const { data: comment } = await supabase.from("comments").select("content").eq("id", commentId).single();
  if (!comment) return { error: "Not found" };

  const analysis = await analyzeCommentWithAI(comment.content);
  const { error } = await supabase.from("comments").update(analysis).eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath("/comments");
  revalidatePath("/dashboard");
  return { success: true, analysis };
}

/**
 * One AI call per comment, so this has to stay a batch.
 *
 * The previous version selected every comment in the workspace and classified
 * them one at a time in a single request: PostgREST capped the selection at
 * 1000 rows, and 1000 sequential model calls cannot finish inside a serverless
 * invocation anyway. Now it takes the oldest unclassified batch and reports
 * what is left so the caller can run it again.
 */
export async function classifyAllComments() {
  const batchSize = 40;
  const user = await requirePermission("comments.moderate");
  const supabase = await createClient();

  const { count: remainingBefore } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", user.profile.tenant_id)
    .is("sentiment", null);

  const { data: comments, error } = await supabase
    .from("comments")
    .select("id, content")
    .eq("tenant_id", user.profile.tenant_id)
    .is("sentiment", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) return { error: error.message };

  if (!comments?.length) {
    const { count: total } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.profile.tenant_id);
    return total
      ? { success: true, count: 0, remaining: 0, message: "Every comment is already classified." }
      : { success: true, count: 0, remaining: 0, message: "No comments found. Sync Facebook first." };
  }

  let count = 0;
  for (const c of comments) {
    const analysis = await analyzeCommentWithAI(c.content);
    const { error: updateError } = await supabase.from("comments").update(analysis).eq("id", c.id);
    if (updateError) break;
    count++;
  }

  const remaining = Math.max(0, (remainingBefore ?? count) - count);

  revalidatePath("/comments");
  revalidatePath("/dashboard");
  revalidatePath("/sentiment");
  return { success: true, count, remaining };
}

export async function getSuggestedReply(commentId: string) {
  await requirePermission("comments.reply");
  const supabase = await createClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("content, issue_topic, sentiment, author_name")
    .eq("id", commentId)
    .single();
  if (!comment) return { error: "Not found" };
  const suggestion = await suggestReply(comment);
  return { suggestion };
}
