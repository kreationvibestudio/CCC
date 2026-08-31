import { NextRequest, NextResponse } from "next/server";
import { syncFacebookForConfiguredTenants } from "@/lib/integrations/facebook/sync";
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
    const results = await syncFacebookForConfiguredTenants();
    const { recordFacebookSyncOutcome } = await import("@/lib/social/facebook-connection");
    for (const r of results) {
      if ("error" in r) {
        await recordFacebookSyncOutcome(r.tenantId, { ok: false, error: r.error });
      } else if (r.tokenSource !== "demo") {
        await recordFacebookSyncOutcome(r.tenantId, { ok: true });
      }
    }
    return NextResponse.json({
      success: true,
      results: results.map((r) =>
        "error" in r
          ? { tenantId: r.tenantId, error: r.error }
          : {
              tenantId: r.tenantId,
              pageName: r.page.name,
              postsSynced: r.postsSynced,
              commentsSynced: r.commentsSynced,
              warning: r.commentsSkippedReason,
              tokenSource: r.tokenSource,
            }
      ),
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
