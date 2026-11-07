/** Pure helpers for Facebook Watch paste-to-capture (no Graph timeline scrape). */

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "web.facebook.com",
  "m.facebook.com",
  "mbasic.facebook.com",
  "fb.com",
  "www.fb.com",
]);

export type ParsedOgTags = {
  title: string | null;
  description: string | null;
  url: string | null;
};

export type CapturedWatchPost = {
  sourceUrl: string;
  canonicalUrl: string;
  authorName: string | null;
  facebookUsername: string | null;
  title: string | null;
  body: string | null;
  keywordHits: string[];
};

export function normalizeFacebookUsername(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes("facebook.com") || trimmed.includes("fb.com")) {
      const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const url = new URL(withProto);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "profile.php") {
        return (url.searchParams.get("id") || "").trim();
      }
      if (parts[0] === "people" && parts[1]) return decodeURIComponent(parts[1]);
      if (parts[0] && !["share", "watch", "reel", "groups", "events", "permalink.php"].includes(parts[0])) {
        return decodeURIComponent(parts[0]).replace(/^@/, "");
      }
      return "";
    }
  } catch {
    // fall through
  }
  return trimmed.replace(/^@/, "").replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "";
}

export function isFacebookPostOrShareUrl(raw: string) {
  try {
    const withProto = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    const url = new URL(withProto);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (![...FACEBOOK_HOSTS].some((h) => h === url.hostname.toLowerCase() || host === h.replace(/^www\./, ""))) {
      return false;
    }
    const path = url.pathname.toLowerCase();
    return (
      path.includes("/share/p/") ||
      path.includes("/posts/") ||
      path.includes("/permalink.php") ||
      path.includes("/story.php") ||
      path.includes("/photo") ||
      path.includes("/videos/") ||
      path.includes("/reel/")
    );
  } catch {
    return false;
  }
}

export function parseOpenGraphTags(html: string): ParsedOgTags {
  const pick = (property: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
      "i"
    );
    const match = html.match(re);
    const value = (match?.[1] || match?.[2] || "").trim();
    return value ? decodeHtmlEntities(value) : null;
  };
  return {
    title: pick("og:title"),
    description: pick("og:description"),
    url: pick("og:url"),
  };
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function usernameFromFacebookUrl(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    if (parts[0] === "profile.php") return url.searchParams.get("id");
    if (parts[0] === "people" && parts[1]) return decodeURIComponent(parts[1]);
    if (["share", "watch", "reel", "groups", "events", "permalink.php", "story.php"].includes(parts[0])) {
      return null;
    }
    return decodeURIComponent(parts[0]).replace(/^@/, "");
  } catch {
    return null;
  }
}

export function canonicalizeFacebookUrl(raw: string) {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("_") || ["rdid", "share_url", "mibextid", "ref", "refsrc"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.replace(/^web\./, "www.").replace(/^m\./, "www.").replace(/^mbasic\./, "www.");
    if (url.hostname === "fb.com" || url.hostname === "www.fb.com") url.hostname = "www.facebook.com";
    let href = url.toString();
    if (href.endsWith("/") && url.pathname !== "/") href = href.slice(0, -1);
    return href;
  } catch {
    return raw.trim();
  }
}

/** Default campaign-ish keywords; callers merge tenant-specific terms. */
export const DEFAULT_WATCH_KEYWORDS = [
  "election",
  "elections",
  "campaign",
  "vote",
  "voting",
  "ballot",
  "poll",
  "polling",
  "candidate",
  "governor",
  "gubernatorial",
  "edo",
  "ndc",
  "pdp",
  "apc",
  "labour party",
  "lp",
];

export function matchCampaignKeywords(
  text: string,
  keywords: string[] = DEFAULT_WATCH_KEYWORDS
): string[] {
  const haystack = text.toLowerCase();
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const raw of keywords) {
    const term = raw.trim().toLowerCase();
    if (!term || seen.has(term)) continue;
    // Word-ish boundary for short tokens; substring for multi-word phrases.
    const found =
      term.includes(" ")
        ? haystack.includes(term)
        : new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:[^a-z0-9]|$)`, "i").test(haystack);
    if (found) {
      seen.add(term);
      hits.push(raw.trim());
    }
  }
  return hits;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCapturedWatchPost(input: {
  sourceUrl: string;
  finalUrl: string;
  og: ParsedOgTags;
  keywords?: string[];
}): CapturedWatchPost {
  const canonicalUrl = canonicalizeFacebookUrl(input.og.url || input.finalUrl || input.sourceUrl);
  const username = usernameFromFacebookUrl(canonicalUrl) || usernameFromFacebookUrl(input.finalUrl);
  const title = input.og.title;
  const body = input.og.description;
  const authorName = title?.trim() || null;
  const keywordHits = matchCampaignKeywords(`${title ?? ""}\n${body ?? ""}`, input.keywords);
  return {
    sourceUrl: input.sourceUrl.trim(),
    canonicalUrl,
    authorName,
    facebookUsername: username,
    title,
    body,
    keywordHits,
  };
}
