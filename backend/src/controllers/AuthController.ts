import { Hono } from "hono";
import { sign } from "hono/jwt";

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
    const { email, password } = await c.req.json();

    if (email !== this.adminEmail || password !== this.adminPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await sign(
      { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
      this.jwtSecret,
    );

    return c.json({ token });
  }

  private async me(c: any) {
    const payload = c.get("jwtPayload");
    return c.json({ email: payload?.email });
  }
}
