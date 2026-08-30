export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * A small, bounded in-process limiter for endpoints whose work must be
 * protected before it reaches the database, email provider, or parser.
 *
 * The key store is deliberately capped so the limiter cannot become a new
 * memory-exhaustion vector when callers present many different identities.
 * Deployments with multiple application instances should also enforce these
 * limits at the edge, but this protects each application process by default.
 */
export function createMemoryRateLimiter({
  windowMs,
  maxRequests,
  maxKeys = 10_000,
}: RateLimiterOptions) {
  const buckets = new Map<string, RateLimitBucket>();

  const retryAfterSeconds = (resetAt: number, now: number) =>
    Math.max(1, Math.ceil((resetAt - now) / 1000));

  const pruneExpired = (now: number) => {
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  };

  return (key: string, now = Date.now()): RateLimitDecision => {
    pruneExpired(now);

    const current = buckets.get(key);
    if (current) {
      if (current.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: retryAfterSeconds(current.resetAt, now),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (buckets.size >= maxKeys) {
      // Keep existing buckets intact. Refusing a new key is safer than
      // evicting an active bucket and allowing unbounded key churn.
      const earliestReset = Math.min(...Array.from(buckets.values(), bucket => bucket.resetAt));
      return {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(earliestReset, now),
      };
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  };
}