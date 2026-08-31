"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  FacebookApiError,
  fetchPageInfo,
  getWorkingPageToken,
  isUsableFacebookToken,
} from "@/lib/integrations/facebook/client";
import { syncFacebookToDatabase } from "@/lib/integrations/facebook/sync";

function settingString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "value" in value) {
    return String((value as { value: string }).value).trim();
  }
  return "";
}

async function upsertSetting(tenantId: string, key: string, value: string) {
  const admin = createServiceClient();
  const { error } = await admin.from("tenant_settings").upsert(
    { tenant_id: tenantId, key, value },
    { onConflict: "tenant_id,key" }
  );
  if (error) throw new Error(error.message);
}

export async function getFacebookConnectionStatus(tenantId: string) {
  const admin = createServiceClient();
  const [{ data: settings }, { data: account }] = await Promise.all([
    admin
      .from("tenant_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", [
        "facebook_page_id",
        "facebook_page_access_token",
        "facebook_user_access_token",
        "facebook_last_sync_error",
        "facebook_last_live_sync_at",
      ]),
    admin
      .from("social_accounts")
      .select("account_id, account_name, followers, last_synced_at, access_token_encrypted, is_connected")
      .eq("tenant_id", tenantId)
      .eq("platform", "facebook")
      .neq("account_id", "demo-hon-akhakon")
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let pageId = "";
  let hasPageToken = false;
  let hasUserToken = false;
  let lastError = "";
  let lastLiveSyncAt = "";

  for (const row of settings ?? []) {
    const v = settingString(row.value);
    if (row.key === "facebook_page_id") pageId = v;
    if (row.key === "facebook_page_access_token") hasPageToken = isUsableFacebookToken(v);
    if (row.key === "facebook_user_access_token") hasUserToken = isUsableFacebookToken(v);
    if (row.key === "facebook_last_sync_error") lastError = v;
    if (row.key === "facebook_last_live_sync_at") lastLiveSyncAt = v;
  }

  pageId = pageId || process.env.FACEBOOK_PAGE_ID?.trim() || "";
  const envPageToken = isUsableFacebookToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  const envUserToken = isUsableFacebookToken(process.env.FACEBOOK_USER_ACCESS_TOKEN);

  const configured = Boolean(
    pageId &&
      pageId.length >= 5 &&
      (hasPageToken || hasUserToken || envPageToken || envUserToken)
  );

  const lastSyncedAt = account?.last_synced_at || lastLiveSyncAt || null;
  const staleHours = lastSyncedAt
    ? (Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000
    : null;

  return {
    pageId,
    configured,
    hasPageToken: hasPageToken || envPageToken,
    hasUserToken: hasUserToken || envUserToken,
    accountName: account?.account_name ?? null,
    followers: account?.followers ?? null,
    lastSyncedAt,
    lastLiveSyncAt: lastLiveSyncAt || null,
    lastError: lastError || null,
    stale: staleHours != null ? staleHours > 36 : !configured,
    staleHours: staleHours != null ? Math.round(staleHours) : null,
  };
}

/** Save + probe a never-expiring page token from HQ (no Vercel required). */
export async function saveFacebookConnection(input: {
  pageId: string;
  pageAccessToken: string;
  userAccessToken?: string;
}) {
  try {
    const user = await requirePermission("social.manage");
    const tenantId = user.profile.tenant_id;
    const pageId = input.pageId.trim();
    const pageAccessToken = input.pageAccessToken.trim();
    const userAccessToken = (input.userAccessToken ?? "").trim();

    if (!pageId || pageId.length < 5) return { error: "Enter the numeric Facebook Page ID" };
    if (!isUsableFacebookToken(pageAccessToken) && !isUsableFacebookToken(userAccessToken)) {
      return { error: "Paste a page access token (40+ characters) from Meta Graph API Explorer" };
    }

    const { pageToken, source } = await getWorkingPageToken({
      pageId,
      envPageToken: isUsableFacebookToken(pageAccessToken) ? pageAccessToken : null,
      envUserToken: isUsableFacebookToken(userAccessToken) ? userAccessToken : null,
      storedPageToken: null,
    });

    const page = await fetchPageInfo(pageId, pageToken);

    await upsertSetting(tenantId, "facebook_page_id", pageId);
    await upsertSetting(tenantId, "facebook_page_access_token", pageToken);
    if (isUsableFacebookToken(userAccessToken)) {
      await upsertSetting(tenantId, "facebook_user_access_token", userAccessToken);
    }
    await upsertSetting(tenantId, "facebook_last_sync_error", "");

    const admin = createServiceClient();
    const { data: existing } = await admin
      .from("social_accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("platform", "facebook")
      .eq("account_id", pageId)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("social_accounts")
        .update({
          account_name: page.name,
          is_connected: true,
          access_token_encrypted: pageToken,
          followers: page.followers_count ?? page.fan_count ?? 0,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("social_accounts").insert({
        tenant_id: tenantId,
        platform: "facebook",
        account_id: pageId,
        account_name: page.name,
        is_connected: true,
        access_token_encrypted: pageToken,
        followers: page.followers_count ?? page.fan_count ?? 0,
      });
    }

    // Immediate live sync so Social Media updates now
    let syncWarning: string | undefined;
    try {
      const result = await syncFacebookToDatabase(tenantId);
      await upsertSetting(tenantId, "facebook_last_live_sync_at", new Date().toISOString());
      await upsertSetting(tenantId, "facebook_last_sync_error", "");
      syncWarning = result.commentsSkippedReason;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed after saving token";
      await upsertSetting(tenantId, "facebook_last_sync_error", msg.split("\n")[0] ?? msg);
      revalidatePath("/social");
      return {
        error: `Token saved for ${page.name}, but sync failed: ${msg.split("\n")[0]}`,
        pageName: page.name,
        tokenSource: source,
      };
    }

    revalidatePath("/social");
    revalidatePath("/admin");
    return {
      success: true as const,
      pageName: page.name,
      followers: page.followers_count ?? page.fan_count ?? 0,
      tokenSource: source,
      warning: syncWarning,
    };
  } catch (e) {
    if (e instanceof FacebookApiError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Could not save Facebook connection" };
  }
}

export async function recordFacebookSyncOutcome(
  tenantId: string,
  outcome: { ok: true; at?: string } | { ok: false; error: string }
) {
  try {
    if (outcome.ok) {
      await upsertSetting(tenantId, "facebook_last_live_sync_at", outcome.at ?? new Date().toISOString());
      await upsertSetting(tenantId, "facebook_last_sync_error", "");
    } else {
      await upsertSetting(tenantId, "facebook_last_sync_error", outcome.error.slice(0, 500));
    }
  } catch {
    // non-fatal
  }
}
