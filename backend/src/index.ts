import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { jwtMiddleware } from "./middleware/auth";
import { authController, driveController, fileController } from "./container";

const app = new Hono();

// Public routes
app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/auth", authController.publicRoutes);

// All /api/* routes require JWT
app.use("/api/*", jwtMiddleware);

// Protected routes
app.route("/api/auth", authController.protectedRoutes);
app.route("/api/drives", driveController.routes);
app.route("/api/files", fileController.routes);

// Serve frontend static files in production
app.use("/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ root: "./public", path: "index.html" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
