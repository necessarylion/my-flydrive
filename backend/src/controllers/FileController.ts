import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Disk } from "flydrive";
import { FileService, PreviewTooLargeError, EmptyFolderError } from "../services/FileService";
import type { ChunkedUploadService } from "../services/ChunkedUploadService";
import type { DriveConfig } from "../types/drive";
import type { DriveService } from "../services/DriveService";
import { assertSafePath, PathTraversalError, sanitizeContentDisposition, safeErrorMessage } from "../utils/validation";

type DiskEnv = { Variables: { disk: Disk; driveConfig: DriveConfig } };

export class FileController {
  readonly routes = new Hono<DiskEnv>();

  constructor(
    private fileService: FileService,
    private chunkedUploadService: ChunkedUploadService,
    private driveService: DriveService,
  ) {
    this.routes.use("/:driveId/*", this.resolveDisk.bind(this));
    this.routes.use("/:driveId", this.resolveDisk.bind(this));

    this.routes.get("/:driveId/list", this.list.bind(this));
    this.routes.post("/:driveId/upload", this.upload.bind(this));
    this.routes.post("/:driveId/upload-chunk", this.uploadChunk.bind(this));
    this.routes.post("/:driveId/upload-complete", this.uploadComplete.bind(this));
    this.routes.get("/:driveId/download", this.download.bind(this));
    this.routes.get("/:driveId/preview", this.preview.bind(this));
    this.routes.get("/:driveId/download-folder", this.downloadFolder.bind(this));
    this.routes.delete("/:driveId", this.remove.bind(this));
    this.routes.post("/:driveId/folder", this.createFolder.bind(this));
    this.routes.patch("/:driveId/rename", this.rename.bind(this));
    this.routes.get("/:driveId/search", this.search.bind(this));
  }

  private async resolveDisk(c: Context<DiskEnv>, next: Next) {
    const driveId = c.req.param("driveId") as string;
    const driveConfig = this.driveService.getById(driveId);
    if (!driveConfig) return c.json({ error: "Drive not found" }, 404);
    const disk = this.fileService.getDisk(driveId);
    if (!disk) return c.json({ error: "Drive not found" }, 404);
    c.set("disk", disk);
    c.set("driveConfig", driveConfig);
    await next();
  }

  private async list(c: Context<DiskEnv>) {
    const prefix = c.req.query("path") || "";
    try {
      if (prefix) assertSafePath(prefix);
      const result = await this.fileService.listFiles(c.get("disk"), prefix);
      return c.json(result);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async upload(c: Context<DiskEnv>) {
    const targetPath = c.req.query("path") || "";
    try {
      if (targetPath) assertSafePath(targetPath);
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return c.json({ error: "No file provided" }, 400);

      const filePath = await this.fileService.upload(c.get("disk"), targetPath, file);
      return c.json({ message: "File uploaded", path: filePath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async uploadChunk(c: Context<DiskEnv>) {
    try {
      const targetPath = c.req.query("path") || "";
      if (targetPath) assertSafePath(targetPath);
      const formData = await c.req.formData();
      const chunk = formData.get("chunk") as File | null;
      const uploadId = formData.get("uploadId") as string;
      const chunkIndex = formData.get("chunkIndex") as string;
      const fileName = formData.get("fileName") as string;
      if (!chunk || !uploadId || chunkIndex == null || !fileName) {
        return c.json({ error: "chunk, uploadId, chunkIndex, and fileName are required" }, 400);
      }

      const idx = parseInt(chunkIndex);
      if (isNaN(idx) || idx < 0 || idx > 10000) {
        return c.json({ error: "Invalid chunkIndex" }, 400);
      }

      const buffer = Buffer.from(await chunk.arrayBuffer());
      await this.chunkedUploadService.stageChunk(
        c.get("driveConfig"), uploadId, idx, buffer, fileName, targetPath,
      );
      return c.json({ message: "Chunk uploaded" });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async uploadComplete(c: Context<DiskEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    try {
      const { uploadId, totalChunks } = body;
      if (!uploadId || !totalChunks) {
        return c.json({ error: "uploadId and totalChunks are required" }, 400);
      }
      if (typeof totalChunks !== "number" || totalChunks < 1 || totalChunks > 10000) {
        return c.json({ error: "Invalid totalChunks" }, 400);
      }
      const filePath = await this.chunkedUploadService.complete(
        c.get("driveConfig"), uploadId, totalChunks,
      );
      return c.json({ message: "File uploaded", path: filePath }, 201);
    } catch (err: any) {
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async download(c: Context<DiskEnv>) {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, fileName } = await this.fileService.download(c.get("disk"), filePath);
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": sanitizeContentDisposition(fileName),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async preview(c: Context<DiskEnv>) {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, contentType } = await this.fileService.preview(c.get("disk"), filePath);
      return new Response(bytes, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(bytes.length),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      if (err instanceof PreviewTooLargeError) return c.json({ error: err.message }, 413);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async downloadFolder(c: Context<DiskEnv>) {
    const folderPath = c.req.query("path") || "";
    try {
      if (folderPath) assertSafePath(folderPath);
      const { stream, folderName } = await this.fileService.downloadFolder(c.get("disk"), folderPath);
      return new Response(stream as any, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": sanitizeContentDisposition(`${folderName}.zip`),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      if (err instanceof EmptyFolderError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async remove(c: Context<DiskEnv>) {
    const filePath = c.req.query("path");
    const isDirectory = c.req.query("isDirectory") === "true";
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      await this.fileService.deleteItem(c.get("disk"), filePath, isDirectory);
      return c.json({ message: isDirectory ? "Folder deleted" : "File deleted" });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async createFolder(c: Context<DiskEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const folderPath = body.path;
    if (!folderPath || typeof folderPath !== "string") {
      return c.json({ error: "Path is required" }, 400);
    }

    try {
      assertSafePath(folderPath);
      await this.fileService.createFolder(c.get("disk"), folderPath);
      return c.json({ message: "Folder created", path: folderPath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async rename(c: Context<DiskEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { path: oldPath, newName, isDirectory } = body;

    if (!oldPath || !newName) return c.json({ error: "path and newName are required" }, 400);
    if (newName.includes("/") || newName.includes("\\")) return c.json({ error: "newName must not contain path separators" }, 400);
    if (newName === ".." || newName === ".") return c.json({ error: "Invalid newName" }, 400);

    try {
      assertSafePath(oldPath);
      const newPath = await this.fileService.rename(c.get("disk"), oldPath, newName, isDirectory);
      return c.json({ message: "Renamed successfully", oldPath, newPath });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  private async search(c: Context<DiskEnv>) {
    const query = c.req.query("q");
    if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

    try {
      const items = await this.fileService.search(c.get("disk"), query);
      return c.json({ query, items });
    } catch (err: any) {
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }
}
