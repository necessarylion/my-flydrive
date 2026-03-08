import { Service } from "typedi";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import type { Disk as Drive } from "flydrive";
import type { FileItem } from "../types/drive";
import { DriveService } from "./DriveService";
import { StorageService } from "./StorageService";

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

@Service()
export class FileService {
  constructor(
    private driveService: DriveService,
    private storageService: StorageService,
  ) {}

  getDrive(driveId: string): Drive | null {
    const drive = this.driveService.getById(driveId);
    if (!drive) return null;
    return this.storageService.createDrive(drive);
  }

  async listFiles(drive: Drive, prefix: string): Promise<{ path: string; items: FileItem[] }> {
    const listing = await drive.listAll(prefix, { recursive: false });
    const { items, metaPromises } = this.mapListingToFileItems(listing.objects);
    await Promise.all(metaPromises);
    return { path: prefix, items };
  }

  async upload(drive: Drive, targetPath: string, file: File): Promise<string> {
    const safeName = sanitizeFileName(file.name);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;
    const buffer = await file.arrayBuffer();
    await drive.put(filePath, new Uint8Array(buffer));
    return filePath;
  }

  async download(drive: Drive, filePath: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const bytes = await drive.getBytes(filePath);
    const fileName = filePath.split("/").pop() || "file";
    return { bytes, fileName };
  }

  async preview(drive: Drive, filePath: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const meta = await drive.getMetaData(filePath);
    if (meta.contentLength > MAX_PREVIEW_SIZE) {
      throw new PreviewTooLargeError();
    }
    const bytes = await drive.getBytes(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_MAP[ext] || meta.contentType || "application/octet-stream";
    return { bytes, contentType };
  }

  async downloadFolder(drive: Drive, folderPath: string): Promise<{ stream: PassThrough; folderName: string }> {
    const listing = await drive.listAll(folderPath, { recursive: true });
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
      const bytes = await drive.getBytes(f.key);
      const nameInZip = folderPath
        ? f.key.slice(folderPath.length).replace(/^\//, "")
        : f.key;
      archive.append(Buffer.from(bytes), { name: nameInZip });
    }

    archive.finalize();
    return { stream: passthrough, folderName };
  }

  async deleteItem(drive: Drive, filePath: string, isDirectory: boolean): Promise<void> {
    if (isDirectory) {
      await drive.deleteAll(filePath);
    } else {
      await drive.delete(filePath);
    }
  }

  async createFolder(drive: Drive, folderPath: string): Promise<void> {
    await drive.put(`${folderPath}/.keep`, new Uint8Array(0));
  }

  async rename(drive: Drive, oldPath: string, newName: string, isDirectory: boolean): Promise<string> {
    const parts = oldPath.split("/").filter(Boolean);
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    const isCaseOnlyRename = oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath;

    if (isDirectory) {
      await this.renameDirectory(drive, oldPath, newPath, isCaseOnlyRename);
    } else {
      await this.renameFile(drive, oldPath, newPath, isCaseOnlyRename);
    }

    return newPath;
  }

  private async renameDirectory(drive: Drive, oldPath: string, newPath: string, isCaseOnly: boolean) {
    const listing = await drive.listAll(oldPath, { recursive: true });
    const fileItems = this.getFileObjects(listing.objects);

    if (isCaseOnly) {
      const fileBuffers: { relativePath: string; data: Uint8Array }[] = [];
      for (const file of fileItems) {
        const f = file as unknown as { key: string };
        const relativePath = f.key.slice(oldPath.length);
        const bytes = await drive.getBytes(f.key);
        fileBuffers.push({ relativePath, data: bytes });
      }
      await drive.deleteAll(oldPath);
      for (const { relativePath, data } of fileBuffers) {
        await drive.put(newPath + relativePath, data);
      }
    } else {
      for (const file of fileItems) {
        const f = file as unknown as { key: string };
        const relativePath = f.key.slice(oldPath.length);
        await drive.move(f.key, newPath + relativePath);
      }
      try { await drive.deleteAll(oldPath); } catch (err) {
        console.warn("Failed to clean up old directory after rename:", oldPath);
      }
    }
  }

  private async renameFile(drive: Drive, oldPath: string, newPath: string, isCaseOnly: boolean) {
    if (isCaseOnly) {
      const bytes = await drive.getBytes(oldPath);
      await drive.delete(oldPath);
      await drive.put(newPath, bytes);
    } else {
      await drive.move(oldPath, newPath);
    }
  }

  async search(drive: Drive, query: string): Promise<FileItem[]> {
    const listing = await drive.listAll("", { recursive: true });
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
