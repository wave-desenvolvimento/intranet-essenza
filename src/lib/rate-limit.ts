/**
 * Simple in-memory rate limiter for serverless.
 * Sufficient for single-instance (Vercel) — for multi-instance use Upstash Redis.
 */

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

export function rateLimit(key: string, options: RateLimitOptions): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowSec * 1000 });
    return { success: true, remaining: options.limit - 1 };
  }

  if (entry.count >= options.limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: options.limit - entry.count };
}

// Cleanup stale entries every 5 minutes
if (typeof globalThis !== "undefined") {
  const CLEANUP_INTERVAL = 5 * 60 * 1000;
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  };
  if (typeof setInterval !== "undefined") {
    setInterval(cleanup, CLEANUP_INTERVAL);
  }
}
