import type { Context, Next } from 'hono';

/**
 * Hono middleware that appends security-related HTTP headers to every response.
 *
 * Headers set:
 * - `X-Content-Type-Options: nosniff` - Prevents MIME-type sniffing.
 * - `X-Frame-Options: DENY` - Blocks the page from being rendered in iframes.
 * - `X-XSS-Protection: 1; mode=block` - Enables the browser's XSS filter.
 * - `Referrer-Policy: strict-origin-when-cross-origin` - Limits referrer information sent cross-origin.
 * - `Permissions-Policy` - Disables camera, microphone, and geolocation APIs.
 *
 * @param c - The Hono request context.
 * @param next - The next middleware or route handler.
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
