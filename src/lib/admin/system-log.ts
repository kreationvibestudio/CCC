import { createClient } from "@/lib/supabase/server";
import { isPlaceholderFacebookAuthor } from "@/lib/integrations/facebook/comment-author";
import { hiddenCommenterSummary } from "@/lib/integrations/facebook/commenter-names-access";

export type SystemLogLevel = "warning" | "error" | "event";

export type SystemLogEntry = {
  id: string;
  level: SystemLogLevel;
  source: string;
  title: string;
  summary: string;
  href?: string;
  /** When set, the Facebook commenter-names card should render with this count. */
  facebookHiddenAuthors?: number;
  createdAt: string | null;
};

/** Live ops warnings/events for Admin → System log (not shown on HQ work screens). */
export async function getAdminSystemLog(tenantId: string): Promise<SystemLogEntry[]> {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select("id, platform, author_name, created_at")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .order("created_at", { ascending: false })
    .limit(500);

  const hidden = (comments ?? []).filter((c) =>
    isPlaceholderFacebookAuthor(c.author_name as string)
  );
  const entries: SystemLogEntry[] = [];

  if (hidden.length > 0) {
    const newest = hidden[0]?.created_at ?? null;
    entries.push({
      id: "facebook-commenter-names",
      level: "warning",
      source: "Facebook / Comments",
      title: hiddenCommenterSummary(hidden.length),
      summary:
        "Meta strips visitor names until Business verification and App Review for Business Asset User Profile Access. Handled under Admin → System log.",
      href: "/comments",
      facebookHiddenAuthors: hidden.length,
      createdAt: typeof newest === "string" ? newest : null,
    });
  }

  return entries;
}
