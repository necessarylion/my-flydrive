import { Hono } from "hono";
import { sign } from "hono/jwt";

const auth = new Hono();

auth.post("/login", async (c) => {
  const { email, password } = await c.req.json();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET!;

  if (email !== adminEmail || password !== adminPassword) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await sign(
    { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
    jwtSecret
  );

  return c.json({ token });
});

auth.get("/me", async (c) => {
  const payload = c.get("jwtPayload" as never);
  return c.json({ email: (payload as any)?.email });
});

export default auth;
