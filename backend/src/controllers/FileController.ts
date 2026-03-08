import { Service } from "typedi";
import type { Context } from "hono";
import type { Disk as Drive } from "flydrive";
import { FileService, PreviewTooLargeError, EmptyFolderError } from "../services/FileService";
import { ChunkedUploadService } from "../services/ChunkedUploadService";
import type { DriveConfig } from "../types/drive";
import { assertSafePath, PathTraversalError, sanitizeContentDisposition, safeErrorMessage } from "../utils/validation";

export type DriveEnv = { Variables: { drive: Drive; driveConfig: DriveConfig } };

@Service()
export class FileController {
  constructor(
    private fileService: FileService,
    private chunkedUploadService: ChunkedUploadService,
  ) {}

  async list(c: Context<DriveEnv>) {
    const prefix = c.req.query("path") || "";
    try {
      if (prefix) assertSafePath(prefix);
      const result = await this.fileService.listFiles(c.get("drive"), prefix);
      return c.json(result);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  async upload(c: Context<DriveEnv>) {
    const targetPath = c.req.query("path") || "";
    try {
      if (targetPath) assertSafePath(targetPath);
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return c.json({ error: "No file provided" }, 400);

      const filePath = await this.fileService.upload(c.get("drive"), targetPath, file);
      return c.json({ message: "File uploaded", path: filePath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  async uploadChunk(c: Context<DriveEnv>) {
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

  async uploadComplete(c: Context<DriveEnv>) {
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

  async download(c: Context<DriveEnv>) {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, fileName } = await this.fileService.download(c.get("drive"), filePath);
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

  async preview(c: Context<DriveEnv>) {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, contentType } = await this.fileService.preview(c.get("drive"), filePath);
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

  async downloadFolder(c: Context<DriveEnv>) {
    const folderPath = c.req.query("path") || "";
    try {
      if (folderPath) assertSafePath(folderPath);
      const { stream, folderName } = await this.fileService.downloadFolder(c.get("drive"), folderPath);
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

  async remove(c: Context<DriveEnv>) {
    const filePath = c.req.query("path");
    const isDirectory = c.req.query("isDirectory") === "true";
    if (!filePath) return c.json({ error: "Path is required" }, 400);

    try {
      assertSafePath(filePath);
      await this.fileService.deleteItem(c.get("drive"), filePath, isDirectory);
      return c.json({ message: isDirectory ? "Folder deleted" : "File deleted" });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  async createFolder(c: Context<DriveEnv>) {
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
      await this.fileService.createFolder(c.get("drive"), folderPath);
      return c.json({ message: "Folder created", path: folderPath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  async rename(c: Context<DriveEnv>) {
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
      const newPath = await this.fileService.rename(c.get("drive"), oldPath, newName, isDirectory);
      return c.json({ message: "Renamed successfully", oldPath, newPath });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  async search(c: Context<DriveEnv>) {
    const query = c.req.query("q");
    if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

    try {
      const items = await this.fileService.search(c.get("drive"), query);
      return c.json({ query, items });
    } catch (err: any) {
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }
}
