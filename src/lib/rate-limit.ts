import { createServiceClient } from "@/lib/supabase/admin";
import {
  localRateLimit,
  rateLimitKey,
  RATE_LIMITS,
  type RateLimitBucket,
  type RateLimitRule,
  type RateLimitVerdict,
} from "@/lib/rate-limit-core";

export {
  clientIp,
  localRateLimit,
  rateLimitKey,
  resetLocalRateLimits,
  RATE_LIMITS,
} from "@/lib/rate-limit-core";
export type { RateLimitBucket, RateLimitRule, RateLimitVerdict } from "@/lib/rate-limit-core";

/**
 * Count one request against a shared window.
 *
 * Falls back to a per-instance counter when the `rate_limit_hit` migration has
 * not been applied yet, so an un-migrated deployment degrades to weaker limiting
 * instead of none at all. Never throws: a limiter outage must not take down the
 * endpoint it protects.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  identity: string,
  overrides?: Partial<RateLimitRule> & { increment?: number }
): Promise<RateLimitVerdict> {
  const { increment = 1, ...ruleOverrides } = overrides ?? {};
  const rule = { ...RATE_LIMITS[bucket], ...ruleOverrides };
  const key = rateLimitKey(bucket, identity);

  try {
    const admin = createServiceClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_increment: increment,
    });
    if (error) return localRateLimit(key, rule, Date.now(), increment);

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; retry_after?: number }
      | null
      | undefined;
    if (!row || typeof row.allowed !== "boolean") return localRateLimit(key, rule, Date.now(), increment);

    return {
      allowed: row.allowed,
      retryAfterSeconds: row.allowed ? 0 : Math.max(1, Number(row.retry_after ?? rule.windowSeconds)),
    };
  } catch {
    return localRateLimit(key, rule, Date.now(), increment);
  }
}

export function tooManyRequests(verdict: RateLimitVerdict, message: string) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, verdict.retryAfterSeconds)) } }
  );
}
