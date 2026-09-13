"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { denyWriteIfRestricted } from "@/types/auth";
import { draftPostWithAI } from "@/lib/ai/draft-post";
import { isIssueTopic } from "@/lib/media/topics";
import { statusPatch } from "@/lib/media/status";
import { publishFacebookPagePost } from "@/lib/integrations/facebook/publish";
import { isMissingRelationError } from "@/lib/public-error";
import type { MediaContentStatus } from "@/types/database";

function revalidateMedia() {
  revalidatePath("/media");
  revalidatePath("/dashboard");
}

function cleanPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

export async function getMediaContentSql() {
  const gate = await authorize("social.view");
  if (!gate.ok) return { error: gate.error };
  try {
    const sql = await readFile(
      join(process.cwd(), "supabase/migrations/20260913180000_media_content.sql"),
      "utf8"
    );
    return { sql };
  } catch {
    return { error: "Could not read the media_content migration." };
  }
}

export async function createMediaContent(input: {
  title: string;
  body: string;
  issue_topic?: string | null;
  talking_points?: string[];
  scheduled_at?: string | null;
}) {
  const gate = await authorize("social.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyWriteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { error: "Give the post a title" };
  if (!body) return { error: "Write the post body" };

  const scheduledAt = input.scheduled_at?.trim() || null;
  const status: MediaContentStatus = scheduledAt ? "scheduled" : "draft";

  const supabase = await createClient();
  const { error } = await supabase.from("media_content").insert({
    tenant_id: gate.user.profile.tenant_id,
    title,
    body,
    issue_topic: isIssueTopic(input.issue_topic) ? input.issue_topic : null,
    platform: "facebook",
    status,
    scheduled_at: scheduledAt,
    talking_points: cleanPoints(input.talking_points),
    created_by: gate.user.id,
  });

  if (error) {
    if (isMissingRelationError(error.message, "media_content")) {
      return { error: "Apply the media_content SQL in Supabase, then refresh." };
    }
    return { error: error.message };
  }

  revalidateMedia();
  return { success: true };
}

export async function draftFromIssue(topic: string) {
  const gate = await authorize("social.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyWriteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const issue = isIssueTopic(topic) ? topic : "other";
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select("content")
    .eq("tenant_id", gate.user.profile.tenant_id)
    .eq("issue_topic", issue)
    .order("created_at", { ascending: false })
    .limit(8);

  const draft = await draftPostWithAI(
    issue,
    (comments ?? []).map((row) => String(row.content ?? ""))
  );

  const { error } = await supabase.from("media_content").insert({
    tenant_id: gate.user.profile.tenant_id,
    title: draft.title,
    body: draft.body,
    issue_topic: issue === "other" ? null : issue,
    platform: "facebook",
    status: "draft",
    talking_points: draft.talking_points,
    created_by: gate.user.id,
  });

  if (error) {
    if (isMissingRelationError(error.message, "media_content")) {
      return { error: "Apply the media_content SQL in Supabase, then refresh." };
    }
    return { error: error.message };
  }

  revalidateMedia();
  return { success: true, title: draft.title };
}

export async function updateMediaStatus(
  id: string,
  to: MediaContentStatus,
  extra?: { scheduledAt?: string | null }
) {
  const gate = await authorize("social.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyWriteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: row, error: loadError } = await supabase
    .from("media_content")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Post not found" };

  const next = statusPatch(row.status as MediaContentStatus, to, extra);
  if (!next.ok) return { error: next.error };

  const { error } = await supabase
    .from("media_content")
    .update(next.patch)
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id);

  if (error) return { error: error.message };
  revalidateMedia();
  return { success: true };
}

export async function markMediaPosted(id: string) {
  return updateMediaStatus(id, "posted");
}

export async function publishMediaToFacebook(id: string) {
  const gate = await authorize("social.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyWriteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: row, error: loadError } = await supabase
    .from("media_content")
    .select("id, status, body")
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Post not found" };
  if (row.status === "killed") return { error: "This draft was killed" };

  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  if (!pageId) {
    return {
      success: true,
      published: false,
      copyInstead: true,
      publishError: "No Facebook page id configured. Copy the body into Meta Business Suite.",
    };
  }

  const { data: account } = await supabase
    .from("social_accounts")
    .select("access_token_encrypted")
    .eq("tenant_id", gate.user.profile.tenant_id)
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
    const published = await publishFacebookPagePost(pageId, pageToken, row.body);
    if (!published.ok) {
      return {
        success: true,
        published: false,
        copyInstead: true,
        publishError: published.permission
          ? "This page token cannot publish. Copy the body into Meta Business Suite."
          : published.error,
      };
    }
  } catch (err) {
    return {
      success: true,
      published: false,
      copyInstead: true,
      publishError: err instanceof Error ? err.message : "Facebook publish failed. Copy the body instead.",
    };
  }

  const marked = await updateMediaStatus(id, "posted");
  if ("error" in marked && marked.error) return marked;
  return { success: true, published: true };
}
