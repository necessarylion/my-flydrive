import { cors } from "hono/cors";

const origins = ["http://localhost:5173"];
if (process.env.APP_DOMAIN) {
  origins.push(process.env.APP_DOMAIN);
}

export const corsMiddleware = cors({
  origin: origins,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});
