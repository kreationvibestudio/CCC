export type FacebookSyncMode = "interactive" | "cron";

export type FacebookSyncProfile = {
  mode: FacebookSyncMode;
  maxPosts: number;
  budgetMs: number;
  /** Per-comment Graph enrich during list fetch (slow). */
  enrichAuthorsInline: boolean;
  /** Max placeholder authors to resolve after posts sync. */
  authorRefreshLimit: number;
  /** Stop starting new comment fetches when less than this remains. */
  commentReserveMs: number;
};

/** Manual HQ button — finish before Vercel 60s / gateway 504. */
export const FACEBOOK_SYNC_INTERACTIVE: FacebookSyncProfile = {
  mode: "interactive",
  maxPosts: 10,
  budgetMs: 45_000,
  enrichAuthorsInline: false,
  authorRefreshLimit: 40,
  commentReserveMs: 8_000,
};

/** Overnight cron can dig deeper within the same hard ceiling. */
export const FACEBOOK_SYNC_CRON: FacebookSyncProfile = {
  mode: "cron",
  maxPosts: 25,
  budgetMs: 52_000,
  enrichAuthorsInline: true,
  authorRefreshLimit: 100,
  commentReserveMs: 8_000,
};

export function facebookSyncProfile(mode: FacebookSyncMode = "interactive"): FacebookSyncProfile {
  return mode === "cron" ? FACEBOOK_SYNC_CRON : FACEBOOK_SYNC_INTERACTIVE;
}

export function createSyncDeadline(budgetMs: number, now = Date.now()) {
  const end = now + Math.max(0, budgetMs);
  return {
    remainingMs: () => end - Date.now(),
    expired: () => Date.now() >= end,
    hasMs: (needed: number) => end - Date.now() >= needed,
  };
}

export function partialCommentsWarning(postsLeft: number): string {
  const n = Math.max(0, postsLeft);
  if (n <= 0) {
    return "Synced recent posts. Comment pull stopped early so the request would not time out — sync again for more, or wait for the overnight job.";
  }
  return `Synced recent posts. ${n} older post${n === 1 ? "" : "s"} still need comment pull — sync again, or wait for the overnight job.`;
}
