import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessPitchDeck } from "@/lib/pitch-deck/access";
import { buildSelfContainedPitchHtml } from "@/lib/pitch-deck/build-html";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPitchDeck(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let html: string;
  try {
    html = buildSelfContainedPitchHtml();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pitch deck unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (download) {
    headers.set(
      "Content-Disposition",
      'attachment; filename="CCC-Client-Pitch-Deck.html"'
    );
  }

  return new NextResponse(html, { status: 200, headers });
}
