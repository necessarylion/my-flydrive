import { Hono } from "hono";
import { PassThrough } from "node:stream";
import archiver from "archiver";
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

    const metaPromises: Promise<void>[] = [];

    for (const item of listing.objects) {
      if (item.isFile) {
        if (item.name === ".keep") continue;
        const fileItem: FileItem = {
          name: item.name,
          path: item.key,
          isDirectory: false,
        };
        items.push(fileItem);
        metaPromises.push(
          item.getMetaData().then((meta) => {
            fileItem.size = meta.contentLength;
            fileItem.lastModified = meta.lastModified.toISOString();
          }).catch(() => {})
        );
      } else {
        items.push({
          name: item.name,
          path: item.prefix,
          isDirectory: true,
        });
      }
    }

    await Promise.all(metaPromises);

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
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

// Download folder as zip
files.get("/:driveId/download-folder", async (c) => {
  const driveId = c.req.param("driveId");
  const folderPath = c.req.query("path") || "";

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const listing = await disk.listAll(folderPath, { recursive: true });
    const allObjects = [];
    for (const item of listing.objects) {
      allObjects.push(item);
    }
    const files_list = allObjects.filter(
      (item) => item.isFile && item.name !== ".keep"
    );

    if (files_list.length === 0) {
      return c.json({ error: "Folder is empty" }, 400);
    }

    const folderName = folderPath
      ? folderPath.split("/").filter(Boolean).pop() || "download"
      : "download";

    const archive = archiver("zip", { zlib: { level: 5 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    for (const file of files_list) {
      const f = file as unknown as { key: string };
      const bytes = await disk.getBytes(f.key);
      // Strip the folder prefix so paths inside zip are relative
      const nameInZip = folderPath
        ? f.key.slice(folderPath.length).replace(/^\//, "")
        : f.key;
      archive.append(Buffer.from(bytes), { name: nameInZip });
    }

    archive.finalize();

    return new Response(passthrough as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folderName}.zip"`,
      },
    });
  } catch (err: any) {
    console.error("Download folder error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Delete file or folder
files.delete("/:driveId", async (c) => {
  const driveId = c.req.param("driveId");
  const filePath = c.req.query("path");
  const isDirectory = c.req.query("isDirectory") === "true";

  if (!filePath) return c.json({ error: "Path is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    if (isDirectory) {
      await disk.deleteAll(filePath);
    } else {
      await disk.delete(filePath);
    }
    return c.json({ message: isDirectory ? "Folder deleted" : "File deleted" });
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

// Rename file or folder
files.patch("/:driveId/rename", async (c) => {
  const driveId = c.req.param("driveId");
  const body = await c.req.json();
  const { path: oldPath, newName, isDirectory } = body;

  if (!oldPath || !newName)
    return c.json({ error: "path and newName are required" }, 400);

  if (newName.includes("/"))
    return c.json({ error: "newName must not contain /" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const parts = oldPath.split("/").filter(Boolean);
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");

    const isCaseOnlyRename =
      oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath;

    if (isDirectory) {
      const listing = await disk.listAll(oldPath, { recursive: true });
      const allObjects = [];
      for (const item of listing.objects) {
        allObjects.push(item);
      }
      const fileItems = allObjects.filter((item) => item.isFile);

      if (isCaseOnlyRename) {
        // Case-only rename: read all files into memory, delete old folder, write to new path
        const fileBuffers: { relativePath: string; data: Uint8Array }[] = [];
        for (const file of fileItems) {
          const f = file as unknown as { key: string };
          const relativePath = f.key.slice(oldPath.length);
          const bytes = await disk.getBytes(f.key);
          fileBuffers.push({ relativePath, data: bytes });
        }
        await disk.deleteAll(oldPath);
        for (const { relativePath, data } of fileBuffers) {
          await disk.put(newPath + relativePath, data);
        }
      } else {
        for (const file of fileItems) {
          const f = file as unknown as { key: string };
          const relativePath = f.key.slice(oldPath.length);
          await disk.move(f.key, newPath + relativePath);
        }
        // Clean up old folder
        try { await disk.deleteAll(oldPath); } catch {}
      }
    } else {
      if (isCaseOnlyRename) {
        // Case-only rename: read content, delete, write with new name
        const bytes = await disk.getBytes(oldPath);
        await disk.delete(oldPath);
        await disk.put(newPath, bytes);
      } else {
        await disk.move(oldPath, newPath);
      }
    }

    return c.json({ message: "Renamed successfully", oldPath, newPath });
  } catch (err: any) {
    console.error("Rename error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Search files recursively
files.get("/:driveId/search", async (c) => {
  const driveId = c.req.param("driveId");
  const query = c.req.query("q")?.toLowerCase();

  if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

  const disk = getDisk(driveId);
  if (!disk) return c.json({ error: "Drive not found" }, 404);

  try {
    const listing = await disk.listAll("", { recursive: true });
    const results: FileItem[] = [];
    const metaPromises: Promise<void>[] = [];

    for (const item of listing.objects) {
      if (item.isFile) {
        if (item.name === ".keep") continue;
        if (!item.name.toLowerCase().includes(query)) continue;
        const fileItem: FileItem = {
          name: item.name,
          path: item.key,
          isDirectory: false,
        };
        results.push(fileItem);
        metaPromises.push(
          item.getMetaData().then((meta) => {
            fileItem.size = meta.contentLength;
            fileItem.lastModified = meta.lastModified.toISOString();
          }).catch(() => {})
        );
      } else {
        if (!item.name.toLowerCase().includes(query)) continue;
        results.push({
          name: item.name,
          path: item.prefix,
          isDirectory: true,
        });
      }
    }

    await Promise.all(metaPromises);

    return c.json({ query, items: results });
  } catch (err: any) {
    console.error("Search error:", err);
    return c.json({ error: err.message }, 500);
  }
});

export default files;
