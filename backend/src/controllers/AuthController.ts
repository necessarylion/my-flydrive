import { Hono } from "hono";
import { sign } from "hono/jwt";
import { timingSafeEqual } from "node:crypto";

export class AuthController {
  readonly publicRoutes = new Hono();
  readonly protectedRoutes = new Hono();

  constructor(
    private adminEmail: string,
    private adminPassword: string,
    private jwtSecret: string,
  ) {
    this.publicRoutes.post("/login", this.login.bind(this));
    this.protectedRoutes.get("/me", this.me.bind(this));
  }

  private async login(c: any) {
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

    if (!this.timingSafeCompare(email, this.adminEmail) ||
        !this.timingSafeCompare(password, this.adminPassword)) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await sign(
      { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
      this.jwtSecret,
    );

    return c.json({ token });
  }

  private timingSafeCompare(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    if (bufA.byteLength !== bufB.byteLength) {
      // Still do a comparison to avoid timing leak on length difference
      const dummy = encoder.encode(b);
      timingSafeEqual(dummy, dummy);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  private async me(c: any) {
    const payload = c.get("jwtPayload");
    return c.json({ email: payload?.email });
  }
}
