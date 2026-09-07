export type RateLimitVerdict = {
  allowed: boolean;
  /** Seconds until the current window resets. 0 when the request was allowed. */
  retryAfterSeconds: number;
};

export type RateLimitRule = { limit: number; windowSeconds: number };

/**
 * Limits for the endpoints reachable without a session, plus the two authenticated
 * ones that spend money. Tuned to be generous for real users and hostile to
 * scripted abuse.
 */
export const RATE_LIMITS = {
  /** 8-char access codes are guessable in bulk without this. */
  agentCodeLogin: { limit: 10, windowSeconds: 600 },
  agentCodeLoginPerCode: { limit: 20, windowSeconds: 3600 },
  publicSignup: { limit: 5, windowSeconds: 3600 },
  volunteerSignup: { limit: 10, windowSeconds: 3600 },
  eventCheckIn: { limit: 30, windowSeconds: 3600 },
  donationInit: { limit: 15, windowSeconds: 3600 },
  /** Per workspace per day: bulk SMS costs real money. */
  smsDaily: { limit: 2000, windowSeconds: 86400 },
  smsBurst: { limit: 10, windowSeconds: 60 },
  /** Per user: each call spends OpenAI quota. */
  aiChat: { limit: 40, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export function rateLimitKey(bucket: string, identity: string) {
  const normalized = identity.trim().toLowerCase() || "unknown";
  return `${bucket}:${normalized}`.slice(0, 180);
}

/**
 * Read the caller's IP from proxy headers.
 *
 * Only the first entry of `x-forwarded-for` is trusted, and only because Vercel
 * rewrites that header at the edge. Behind a different proxy this must be
 * revisited: a client-supplied XFF would otherwise let an attacker rotate keys
 * at will.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/** Per-instance fallback used only when the shared counter is unreachable. */
const localWindows = new Map<string, { start: number; hits: number }>();

export function localRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
  increment = 1
): RateLimitVerdict {
  const windowMs = rule.windowSeconds * 1000;
  const step = Math.max(1, increment);
  const existing = localWindows.get(key);

  if (!existing || now - existing.start >= windowMs) {
    localWindows.set(key, { start: now, hits: step });
    return { allowed: step <= rule.limit, retryAfterSeconds: step <= rule.limit ? 0 : rule.windowSeconds };
  }

  existing.hits += step;
  const allowed = existing.hits <= rule.limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.start + windowMs - now) / 1000),
  };
}

/** Test seam: the fallback map is process-global. */
export function resetLocalRateLimits() {
  localWindows.clear();
}
