import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { syncFacebookToDatabase } from "@/lib/integrations/facebook/sync";
import { FacebookApiError, isUsableFacebookToken } from "@/lib/integrations/facebook/client";

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

    return NextResponse.json({
      success: true,
      pageName: result.page.name,
      followers: result.page.followers_count ?? result.page.fan_count ?? 0,
      postsSynced: result.postsSynced,
      commentsSynced: result.commentsSynced,
      warning: result.commentsSkippedReason,
      tokenSource: result.tokenSource,
    });
  } catch (err) {
    const message =
      err instanceof FacebookApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
    const configured = Boolean(
      pageId &&
        pageId !== "[SENSITIVE]" &&
        !/^your[_-]/i.test(pageId) &&
        (isUsableFacebookToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN) ||
          isUsableFacebookToken(process.env.FACEBOOK_USER_ACCESS_TOKEN))
    );

    return NextResponse.json({
      configured,
      hasAppCredentials: Boolean(
        process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim()
      ),
    });
  } catch {
    return NextResponse.json({ configured: false, hasAppCredentials: false });
  }
}
