import { PassThrough } from "node:stream";
import archiver from "archiver";
import type { Disk } from "flydrive";
import type { FileItem } from "../types/drive";
import type { DriveService } from "./DriveService";
import type { StorageService } from "./StorageService";

function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9\-_!.\s]/g, "_");
}

const MIME_MAP: Record<string, string> = {
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

const MAX_PREVIEW_SIZE = 200 * 1024 * 1024;

export class FileService {
  constructor(
    private driveService: DriveService,
    private storageService: StorageService,
  ) {}

  getDisk(driveId: string): Disk | null {
    const drive = this.driveService.getById(driveId);
    if (!drive) return null;
    return this.storageService.createDisk(drive);
  }

  async listFiles(disk: Disk, prefix: string): Promise<{ path: string; items: FileItem[] }> {
    const listing = await disk.listAll(prefix, { recursive: false });
    const { items, metaPromises } = this.mapListingToFileItems(listing.objects);
    await Promise.all(metaPromises);
    return { path: prefix, items };
  }

  async upload(disk: Disk, targetPath: string, file: File): Promise<string> {
    const safeName = sanitizeFileName(file.name);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;
    const buffer = await file.arrayBuffer();
    await disk.put(filePath, new Uint8Array(buffer));
    return filePath;
  }

  async download(disk: Disk, filePath: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const bytes = await disk.getBytes(filePath);
    const fileName = filePath.split("/").pop() || "file";
    return { bytes, fileName };
  }

  async preview(disk: Disk, filePath: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const meta = await disk.getMetaData(filePath);
    if (meta.contentLength > MAX_PREVIEW_SIZE) {
      throw new PreviewTooLargeError();
    }
    const bytes = await disk.getBytes(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_MAP[ext] || meta.contentType || "application/octet-stream";
    return { bytes, contentType };
  }

  async downloadFolder(disk: Disk, folderPath: string): Promise<{ stream: PassThrough; folderName: string }> {
    const listing = await disk.listAll(folderPath, { recursive: true });
    const fileObjects = this.getFileObjects(listing.objects);

    if (fileObjects.length === 0) {
      throw new EmptyFolderError();
    }

    const folderName = folderPath
      ? folderPath.split("/").filter(Boolean).pop() || "download"
      : "download";

    const archive = archiver("zip", { zlib: { level: 5 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    for (const file of fileObjects) {
      const f = file as unknown as { key: string };
      const bytes = await disk.getBytes(f.key);
      const nameInZip = folderPath
        ? f.key.slice(folderPath.length).replace(/^\//, "")
        : f.key;
      archive.append(Buffer.from(bytes), { name: nameInZip });
    }

    archive.finalize();
    return { stream: passthrough, folderName };
  }

  async deleteItem(disk: Disk, filePath: string, isDirectory: boolean): Promise<void> {
    if (isDirectory) {
      await disk.deleteAll(filePath);
    } else {
      await disk.delete(filePath);
    }
  }

  async createFolder(disk: Disk, folderPath: string): Promise<void> {
    await disk.put(`${folderPath}/.keep`, new Uint8Array(0));
  }

  async rename(disk: Disk, oldPath: string, newName: string, isDirectory: boolean): Promise<string> {
    const parts = oldPath.split("/").filter(Boolean);
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    const isCaseOnlyRename = oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath;

    if (isDirectory) {
      await this.renameDirectory(disk, oldPath, newPath, isCaseOnlyRename);
    } else {
      await this.renameFile(disk, oldPath, newPath, isCaseOnlyRename);
    }

    return newPath;
  }

  private async renameDirectory(disk: Disk, oldPath: string, newPath: string, isCaseOnly: boolean) {
    const listing = await disk.listAll(oldPath, { recursive: true });
    const fileItems = this.getFileObjects(listing.objects);

    if (isCaseOnly) {
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
      try { await disk.deleteAll(oldPath); } catch {}
    }
  }

  private async renameFile(disk: Disk, oldPath: string, newPath: string, isCaseOnly: boolean) {
    if (isCaseOnly) {
      const bytes = await disk.getBytes(oldPath);
      await disk.delete(oldPath);
      await disk.put(newPath, bytes);
    } else {
      await disk.move(oldPath, newPath);
    }
  }

  async search(disk: Disk, query: string): Promise<FileItem[]> {
    const listing = await disk.listAll("", { recursive: true });
    const lowerQuery = query.toLowerCase();
    const nameFilter = (name: string) => name.toLowerCase().includes(lowerQuery);
    const { items, metaPromises } = this.mapListingToFileItems(listing.objects, nameFilter);
    await Promise.all(metaPromises);
    return items;
  }

  private mapListingToFileItems(
    objects: Iterable<any>,
    filter?: (name: string) => boolean,
  ): { items: FileItem[]; metaPromises: Promise<void>[] } {
    const items: FileItem[] = [];
    const metaPromises: Promise<void>[] = [];

    for (const item of objects) {
      if (item.isFile) {
        if (item.name === ".keep") continue;
        if (filter && !filter(item.name)) continue;
        const fileItem: FileItem = { name: item.name, path: item.key, isDirectory: false };
        items.push(fileItem);
        metaPromises.push(
          item.getMetaData().then((meta: any) => {
            fileItem.size = meta.contentLength;
            fileItem.lastModified = meta.lastModified.toISOString();
          }).catch(() => {})
        );
      } else {
        if (filter && !filter(item.name)) continue;
        items.push({ name: item.name, path: item.prefix, isDirectory: true });
      }
    }

    return { items, metaPromises };
  }

  private getFileObjects(objects: Iterable<any>) {
    return [...objects].filter((item) => item.isFile && item.name !== ".keep");
  }
}

export class PreviewTooLargeError extends Error {
  constructor() { super("File too large for preview"); }
}

export class EmptyFolderError extends Error {
  constructor() { super("Folder is empty"); }
}
