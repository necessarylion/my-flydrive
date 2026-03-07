import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
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

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// OpenAPI spec
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.0",
    info: {
      title: "My Drive API",
      version: "1.0.0",
      description: "Google Drive-like file management API with multiple storage providers",
    },
    servers: [{ url: "http://localhost:3000" }],
    paths: {
      "/api/drives": {
        get: {
          tags: ["Drives"],
          summary: "List all drives",
          responses: { "200": { description: "List of drives" } },
        },
        post: {
          tags: ["Drives"],
          summary: "Create a new drive",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "type", "config"],
                  properties: {
                    name: { type: "string", example: "My Local Drive" },
                    type: { type: "string", enum: ["local", "s3", "gcs", "azure"] },
                    isDefault: { type: "boolean", default: false },
                    config: {
                      type: "object",
                      description: "Driver-specific configuration",
                      oneOf: [
                        {
                          title: "Local",
                          properties: { root: { type: "string", example: "./uploads" } },
                          required: ["root"],
                        },
                        {
                          title: "S3",
                          properties: {
                            bucket: { type: "string" },
                            region: { type: "string" },
                            accessKeyId: { type: "string" },
                            secretAccessKey: { type: "string" },
                            endpoint: { type: "string" },
                          },
                          required: ["bucket", "region", "accessKeyId", "secretAccessKey"],
                        },
                        {
                          title: "GCS",
                          properties: {
                            bucket: { type: "string" },
                            projectId: { type: "string" },
                            keyFilename: { type: "string" },
                          },
                          required: ["bucket", "projectId"],
                        },
                        {
                          title: "Azure",
                          properties: {
                            connectionString: { type: "string" },
                            container: { type: "string" },
                          },
                          required: ["connectionString", "container"],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Drive created" } },
        },
      },
      "/api/drives/{id}": {
        get: {
          tags: ["Drives"],
          summary: "Get drive by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Drive details" },
            "404": { description: "Drive not found" },
          },
        },
        put: {
          tags: ["Drives"],
          summary: "Update drive",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Drive updated" },
            "404": { description: "Drive not found" },
          },
        },
        delete: {
          tags: ["Drives"],
          summary: "Delete drive",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Drive deleted" },
            "404": { description: "Drive not found" },
          },
        },
      },
      "/api/files/{driveId}/list": {
        get: {
          tags: ["Files"],
          summary: "List files in directory",
          parameters: [
            { name: "driveId", in: "path", required: true, schema: { type: "string" } },
            { name: "path", in: "query", schema: { type: "string", default: "" } },
          ],
          responses: { "200": { description: "File listing" } },
        },
      },
      "/api/files/{driveId}/upload": {
        post: {
          tags: ["Files"],
          summary: "Upload a file",
          parameters: [
            { name: "driveId", in: "path", required: true, schema: { type: "string" } },
            { name: "path", in: "query", schema: { type: "string", default: "" } },
          ],
          requestBody: {
            required: true,
            content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
          },
          responses: { "201": { description: "File uploaded" } },
        },
      },
      "/api/files/{driveId}/download": {
        get: {
          tags: ["Files"],
          summary: "Download a file",
          parameters: [
            { name: "driveId", in: "path", required: true, schema: { type: "string" } },
            { name: "path", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "File content" } },
        },
      },
      "/api/files/{driveId}": {
        delete: {
          tags: ["Files"],
          summary: "Delete a file",
          parameters: [
            { name: "driveId", in: "path", required: true, schema: { type: "string" } },
            { name: "path", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "File deleted" } },
        },
      },
      "/api/files/{driveId}/folder": {
        post: {
          tags: ["Files"],
          summary: "Create a folder",
          parameters: [
            { name: "driveId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { path: { type: "string", example: "my-folder" } },
                  required: ["path"],
                },
              },
            },
          },
          responses: { "201": { description: "Folder created" } },
        },
      },
    },
  });
});

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
