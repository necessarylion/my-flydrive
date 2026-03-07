import { Hono } from "hono";
import { getDriveById } from "../config/store";
import { createDisk } from "../services/storage";
import type { FileItem } from "../types/drive";

const files = new Hono();

function getDisk(driveId: string) {
  const drive = getDriveById(driveId);
  if (!drive) return null;
  return createDisk(drive);
}

// List files in a directory
files.get("/:driveId/list", async (c) => {
  const driveId = c.req.param("driveId");
  const prefix = c.req.query("path") || "";

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const items: FileItem[] = [];
    const listing = await disk.listAll(prefix, { recursive: false });

    for (const item of listing.objects) {
      if (item.isFile) {
        if (item.name === ".keep") continue;
        items.push({
          name: item.name,
          path: item.key,
          isDirectory: false,
        });
      } else {
        items.push({
          name: item.name,
          path: item.prefix,
          isDirectory: true,
        });
      }
    }

    return c.json({ path: prefix, items });
  } catch (err: any) {
    console.error("List error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Upload file
files.post("/:driveId/upload", async (c) => {
  const driveId = c.req.param("driveId");
  const targetPath = c.req.query("path") || "";

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return c.json({ error: "No file provided" }, 400);

    const filePath = targetPath ? `${targetPath}/${file.name}` : file.name;
    const buffer = await file.arrayBuffer();

    await disk.put(filePath, new Uint8Array(buffer));

    return c.json({ message: "File uploaded", path: filePath }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Download file
files.get("/:driveId/download", async (c) => {
  const driveId = c.req.param("driveId");
  const filePath = c.req.query("path");

  if (!filePath) return c.json({ error: "Path is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const bytes = await disk.getBytes(filePath);

    const fileName = filePath.split("/").pop() || "file";
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Preview file (inline, with proper content-type)
files.get("/:driveId/preview", async (c) => {
  const driveId = c.req.param("driveId");
  const filePath = c.req.query("path");

  if (!filePath) return c.json({ error: "Path is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const meta = await disk.getMetaData(filePath);
    const MAX_PREVIEW_SIZE = 200 * 1024 * 1024;
    if (meta.contentLength > MAX_PREVIEW_SIZE) {
      return c.json({ error: "File too large for preview" }, 413);
    }

    const bytes = await disk.getBytes(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
      mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime",
      mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac",
      flac: "audio/flac", m4a: "audio/mp4",
      pdf: "application/pdf",
      txt: "text/plain", json: "application/json", xml: "text/xml",
      csv: "text/csv", md: "text/plain", log: "text/plain",
    };
    const contentType = mimeMap[ext] || meta.contentType || "application/octet-stream";

    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete file
files.delete("/:driveId", async (c) => {
  const driveId = c.req.param("driveId");
  const filePath = c.req.query("path");

  if (!filePath) return c.json({ error: "Path is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    await disk.delete(filePath);
    return c.json({ message: "File deleted" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create folder (by creating a .keep file inside)
files.post("/:driveId/folder", async (c) => {
  const driveId = c.req.param("driveId");
  const body = await c.req.json();
  const folderPath = body.path;

  if (!folderPath) return c.json({ error: "Path is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    await disk.put(`${folderPath}/.keep`, new Uint8Array(0));
    return c.json({ message: "Folder created", path: folderPath }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default files;
