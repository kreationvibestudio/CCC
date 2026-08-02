import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { syncFacebookToDatabase } from "@/lib/integrations/facebook/sync";
import { FacebookApiError } from "@/lib/integrations/facebook/client";

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
    });
  } catch (err) {
    const message = err instanceof FacebookApiError ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configured = Boolean(
      process.env.FACEBOOK_PAGE_ID &&
        (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_USER_ACCESS_TOKEN)
    );

    return NextResponse.json({ configured });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
