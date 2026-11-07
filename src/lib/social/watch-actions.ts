"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { denyWriteIfRestricted } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/public-error";
import {
  DEFAULT_WATCH_KEYWORDS,
  buildCapturedWatchPost,
  isFacebookPostOrShareUrl,
  normalizeFacebookUsername,
  parseOpenGraphTags,
} from "@/lib/social/watch-capture";

const WATCH_KEYWORDS_SETTING = "social_watch_keywords";

export type WatchTargetRow = {
  id: string;
  display_name: string;
  facebook_username: string;
  profile_url: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export type WatchPostRow = {
  id: string;
  target_id: string | null;
  source_url: string;
  canonical_url: string;
  author_name: string | null;
  title: string | null;
  body: string | null;
  keyword_hits: string[] | null;
  status: string;
  captured_at: string;
  social_watch_targets?:
    | { display_name: string; facebook_username: string }
    | { display_name: string; facebook_username: string }[]
    | null;
};

function normalizeWatchPostRow(row: WatchPostRow): WatchPostRow {
  const related = row.social_watch_targets;
  const target = Array.isArray(related) ? related[0] ?? null : related ?? null;
  return { ...row, social_watch_targets: target };
}

function profileUrlForUsername(username: string) {
  return `https://www.facebook.com/${encodeURIComponent(username)}`;
}

async function loadWatchKeywords(tenantId: string) {
  const admin = createServiceClient();
  const { data } = await admin
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", WATCH_KEYWORDS_SETTING)
    .maybeSingle();
  const extra = String(data?.value ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...DEFAULT_WATCH_KEYWORDS, ...extra];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of merged) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export async function listWatchTargets(includeArchived = false) {
  const user = await requirePermission("social.view");
  const supabase = await createClient();
  let query = supabase
    .from("social_watch_targets")
    .select("id, display_name, facebook_username, profile_url, notes, archived_at, created_at")
    .eq("tenant_id", user.profile.tenant_id)
    .order("display_name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error.message, "social_watch_targets")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as WatchTargetRow[];
}

export async function listWatchPosts(input?: {
  targetId?: string | null;
  campaignOnly?: boolean;
  limit?: number;
}) {
  const user = await requirePermission("social.view");
  const supabase = await createClient();
  let query = supabase
    .from("social_watch_posts")
    .select(
      "id, target_id, source_url, canonical_url, author_name, title, body, keyword_hits, status, captured_at, social_watch_targets(display_name, facebook_username)"
    )
    .eq("tenant_id", user.profile.tenant_id)
    .order("captured_at", { ascending: false })
    .limit(Math.min(Math.max(input?.limit ?? 80, 1), 200));
  if (input?.targetId) query = query.eq("target_id", input.targetId);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error.message, "social_watch_posts")) return [];
    throw new Error(error.message);
  }
  const rows = ((data ?? []) as unknown as WatchPostRow[]).map(normalizeWatchPostRow);
  if (input?.campaignOnly) {
    return rows.filter((row) => (row.keyword_hits?.length ?? 0) > 0);
  }
  return rows;
}

export async function createWatchTarget(input: {
  displayName: string;
  facebookUsername: string;
  notes?: string;
}) {
  const user = await requirePermission("social.manage");
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };

  const displayName = input.displayName.trim();
  const facebookUsername = normalizeFacebookUsername(input.facebookUsername);
  if (!displayName) return { error: "Enter a display name" };
  if (!facebookUsername) return { error: "Enter a Facebook username or profile URL" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_watch_targets")
    .insert({
      tenant_id: user.profile.tenant_id,
      display_name: displayName,
      facebook_username: facebookUsername,
      profile_url: profileUrlForUsername(facebookUsername),
      notes: input.notes?.trim() || null,
      created_by: user.profile.id,
    })
    .select("id, display_name, facebook_username")
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error.message, "social_watch_targets")) {
      return { error: "Watch tables need the latest SQL. Apply 20261107230000_social_watchlist.sql." };
    }
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "That Facebook username is already on the watchlist" };
    }
    return { error: error.message };
  }
  revalidatePath("/social");
  return { success: true as const, target: data };
}

export async function archiveWatchTarget(id: string) {
  const user = await requirePermission("social.manage");
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase
    .from("social_watch_targets")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/social");
  return { success: true as const };
}

export async function updateWatchPostStatus(id: string, status: "new" | "reviewed" | "flagged") {
  const user = await requirePermission("social.manage");
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase
    .from("social_watch_posts")
    .update({ status })
    .eq("id", id)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/social");
  return { success: true as const };
}

async function fetchFacebookOg(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CampaignCommandCenter/1.2; +https://github.com/kreationvibestudio/CCC)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await res.text();
    return { finalUrl: res.url || url, og: parseOpenGraphTags(html), ok: res.ok };
  } finally {
    clearTimeout(timer);
  }
}

async function findOrCreateTargetByUsername(
  tenantId: string,
  profileId: string,
  username: string,
  displayNameHint: string | null
) {
  const admin = createServiceClient();
  const normalized = normalizeFacebookUsername(username);
  if (!normalized) return null;
  const { data: existing } = await admin
    .from("social_watch_targets")
    .select("id, display_name, facebook_username, archived_at")
    .eq("tenant_id", tenantId)
    .ilike("facebook_username", normalized)
    .maybeSingle();
  if (existing?.id) {
    if (existing.archived_at) {
      await admin
        .from("social_watch_targets")
        .update({ archived_at: null, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing;
  }
  const { data: created, error } = await admin
    .from("social_watch_targets")
    .insert({
      tenant_id: tenantId,
      display_name: displayNameHint?.trim() || normalized,
      facebook_username: normalized,
      profile_url: profileUrlForUsername(normalized),
      created_by: profileId,
    })
    .select("id, display_name, facebook_username")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return created;
}

export async function captureFacebookWatchUrl(input: {
  url: string;
  targetId?: string | null;
}) {
  const user = await requirePermission("social.manage");
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };

  const sourceUrl = input.url.trim();
  if (!sourceUrl) return { error: "Paste a Facebook post or share link" };
  if (!isFacebookPostOrShareUrl(sourceUrl)) {
    return { error: "That does not look like a Facebook post or share URL" };
  }

  let fetched: Awaited<ReturnType<typeof fetchFacebookOg>>;
  try {
    fetched = await fetchFacebookOg(sourceUrl);
  } catch (e) {
    return {
      error: e instanceof Error && e.name === "AbortError"
        ? "Facebook took too long to respond. Try again."
        : "Could not fetch that Facebook link",
    };
  }

  if (!fetched.og.title && !fetched.og.description && !fetched.og.url) {
    return {
      error:
        "Could not read public post details from that link (Facebook may require login). Open the post and confirm the share link is public.",
    };
  }

  const keywords = await loadWatchKeywords(user.profile.tenant_id);
  const captured = buildCapturedWatchPost({
    sourceUrl,
    finalUrl: fetched.finalUrl,
    og: fetched.og,
    keywords,
  });

  let targetId = input.targetId?.trim() || null;
  if (!targetId && captured.facebookUsername) {
    try {
      const target = await findOrCreateTargetByUsername(
        user.profile.tenant_id,
        user.profile.id,
        captured.facebookUsername,
        captured.authorName
      );
      targetId = target?.id ?? null;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not save watch target" };
    }
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("social_watch_posts")
    .upsert(
      {
        tenant_id: user.profile.tenant_id,
        target_id: targetId,
        source_url: captured.sourceUrl,
        canonical_url: captured.canonicalUrl,
        author_name: captured.authorName,
        title: captured.title,
        body: captured.body,
        keyword_hits: captured.keywordHits,
        status: "new",
        captured_by: user.profile.id,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,canonical_url" }
    )
    .select("id, author_name, keyword_hits, canonical_url")
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message, "social_watch_posts")) {
      return { error: "Watch tables need the latest SQL. Apply 20261107230000_social_watchlist.sql." };
    }
    // Unique index name may not match onConflict — fall back to plain insert error messaging.
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "That post is already in the Watch feed", already: true as const };
    }
    return { error: error.message };
  }

  revalidatePath("/social");
  return {
    success: true as const,
    post: data,
    keywordHits: captured.keywordHits,
    authorName: captured.authorName,
    facebookUsername: captured.facebookUsername,
  };
}
