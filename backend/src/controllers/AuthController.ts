import { Inject, Service } from "typedi";
import { sign } from "hono/jwt";
import { timingSafeEqual } from "node:crypto";
import { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } from "../container";

@Service()
export class AuthController {
  async login(c: any) {
    let body: { email?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { email, password } = body;
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    if (!this.timingSafeCompare(email, ADMIN_EMAIL) ||
        !this.timingSafeCompare(password, ADMIN_PASSWORD)) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await sign(
      { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
      JWT_SECRET,
    );

    return c.json({ token });
  }

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

  async me(c: any) {
    const payload = c.get("jwtPayload");
    return c.json({ email: payload?.email });
  }
}
