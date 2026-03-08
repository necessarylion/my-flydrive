import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { corsMiddleware } from "./middleware/cors";
import { jwtMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import drives from "./routes/drives";
import files from "./routes/files";

const app = new Hono();

app.use("*", corsMiddleware);

// Public routes
app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/auth", authRoutes);

// Protected routes
app.use("/api/drives/*", jwtMiddleware);
app.use("/api/files/*", jwtMiddleware);

// Routes
app.route("/api/drives", drives);
app.route("/api/files", files);

// Serve frontend static files in production
app.use("/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ root: "./public", path: "index.html" }));

const port = 3000;
console.log(`Server running at http://localhost:${port}`);
console.log(`Swagger UI: http://localhost:${port}/docs`);

export default {
  port,
  fetch: app.fetch,
};
