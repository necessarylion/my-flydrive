import type { Context, Next } from 'hono';

/**
 * Represents a single rate limit tracking entry for an IP address.
 */
interface RateLimitEntry {
  /** Number of requests made within the current window. */
  count: number;
  /** Timestamp (ms) when the current rate limit window expires. */
  resetAt: number;
}

/** @internal In-memory store mapping IP-based keys to their rate limit entries. */
const store = new Map<string, RateLimitEntry>();

/** Maximum number of login attempts allowed per IP within a single window. */
const MAX_ATTEMPTS = 10;

/** Duration of the rate limit window in milliseconds (1 minute). */
const WINDOW_MS = 60 * 1000; // 1 minute

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  },
  5 * 60 * 1000,
);

/**
 * Hono middleware that rate-limits login attempts by client IP address.
 *
 * Identifies the client IP from `x-forwarded-for` or `x-real-ip` headers.
 * When the limit is exceeded, responds with HTTP 429 and a `Retry-After` header
 * indicating how many seconds remain until the window resets.
 *
 * @param c - The Hono request context.
 * @param next - The next middleware or route handler.
 * @returns A 429 JSON response if rate limited, otherwise proceeds to the next handler.
 */
export async function loginRateLimiter(c: Context, next: Next) {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const key = `login:${ip}`;
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header('Retry-After', String(retryAfter));
    return c.json({ error: 'Too many login attempts. Please try again later.' }, 429);
  }

  await next();
}
