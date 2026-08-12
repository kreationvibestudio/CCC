import { NextRequest, NextResponse } from "next/server";
import { syncFacebookForDemoTenant } from "@/lib/integrations/facebook/sync";
import { FacebookApiError } from "@/lib/integrations/facebook/client";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Hourly / on-demand Facebook sync for the campaign tenant.
 * Authorized via Vercel Cron header or CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get("x-vercel-cron");
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  const authorized =
    Boolean(cronHeader) ||
    (Boolean(cronSecret) && auth === `Bearer ${cronSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncFacebookForDemoTenant();
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
