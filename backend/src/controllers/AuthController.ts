import { Service } from 'typedi';
import { sign } from 'hono/jwt';
import { timingSafeEqual } from 'node:crypto';
import { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } from '../constants';

@Service()
export class AuthController {
  /**
   * Authenticates a user with email and password, returning a JWT on success.
   *
   * Parses the JSON request body for `email` and `password` fields, validates
   * them against the configured admin credentials using timing-safe comparison,
   * and issues a JWT token with a 24-hour expiration.
   *
   * @param c - The Hono request context.
   * @returns A JSON response containing `{ token }` on success, or an error
   *   response with status 400 (bad request) or 401 (invalid credentials).
   */
  async login(c: any) {
    let body: { email?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const { email, password } = body;
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    if (
      !this.timingSafeCompare(email, ADMIN_EMAIL) ||
      !this.timingSafeCompare(password, ADMIN_PASSWORD)
    ) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await sign(
      { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
      JWT_SECRET,
    );

    return c.json({ token });
  }

  /**
   * Performs a constant-time string comparison to prevent timing attacks.
   *
   * When the two strings differ in length, a dummy comparison is still
   * performed so that the overall execution time remains consistent,
   * avoiding information leakage about the expected value's length.
   *
   * @param a - The user-supplied string to compare.
   * @param b - The expected (secret) string to compare against.
   * @returns `true` if the strings are equal, `false` otherwise.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    if (bufA.byteLength !== bufB.byteLength) {
      const dummy = encoder.encode(b);
      timingSafeEqual(dummy, dummy);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Returns the currently authenticated user's information.
   *
   * Extracts the email from the JWT payload set by the auth middleware
   * and returns it in the response.
   *
   * @param c - The Hono request context (must include `jwtPayload` from auth middleware).
   * @returns A JSON response containing `{ email }` of the authenticated user.
   */
  async me(c: any) {
    const payload = c.get('jwtPayload');
    return c.json({ email: payload?.email });
  }
}
