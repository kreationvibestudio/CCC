import { NextRequest, NextResponse } from "next/server";
import { syncFacebookForCampaignTenant } from "@/lib/integrations/facebook/sync";
import { FacebookApiError } from "@/lib/integrations/facebook/client";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Daily Facebook sync. Vercel Cron sends Authorization: Bearer $CRON_SECRET
 * when that env var is set. Spoofable x-vercel-cron is not accepted alone.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || cronSecret === "[SENSITIVE]" || cronSecret.length < 16) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set a long random value on Vercel (Production)." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncFacebookForCampaignTenant();
    return NextResponse.json({
      success: true,
      pageName: result.page.name,
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
