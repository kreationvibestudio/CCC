import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { syncFacebookToDatabase } from "@/lib/integrations/facebook/sync";
import { FacebookApiError, isUsableFacebookToken } from "@/lib/integrations/facebook/client";
import { getFacebookConnectionStatus, recordFacebookSyncOutcome } from "@/lib/social/facebook-connection";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.permissions.includes("social.manage") && !user.permissions.includes("social.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await syncFacebookToDatabase(user.profile.tenant_id);
    const isDemo = result.tokenSource === "demo";
    if (!isDemo) {
      await recordFacebookSyncOutcome(user.profile.tenant_id, { ok: true });
    }

    return NextResponse.json({
      success: true,
      pageName: result.page.name,
      followers: result.page.followers_count ?? result.page.fan_count ?? 0,
      postsSynced: result.postsSynced,
      commentsSynced: result.commentsSynced,
      warning: result.commentsSkippedReason,
      tokenSource: result.tokenSource,
      demo: isDemo,
    });
  } catch (err) {
    const message =
      err instanceof FacebookApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Sync failed";
    try {
      const user = await getCurrentUser();
      if (user) {
        await recordFacebookSyncOutcome(user.profile.tenant_id, {
          ok: false,
          error: message.split("\n")[0] ?? message,
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getFacebookConnectionStatus(user.profile.tenant_id);
    const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
    const envConfigured = Boolean(
      pageId &&
        pageId !== "[SENSITIVE]" &&
        !/^your[_-]/i.test(pageId) &&
        (isUsableFacebookToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN) ||
          isUsableFacebookToken(process.env.FACEBOOK_USER_ACCESS_TOKEN))
    );

    return NextResponse.json({
      hasAppCredentials: Boolean(
        process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim()
      ),
      envConfigured,
      ...status,
      configured: status.configured || envConfigured,
    });
  } catch {
    return NextResponse.json({ configured: false, hasAppCredentials: false });
  }
}
