import { Service } from 'typedi';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import mime from 'mime';
import type { Disk as Drive } from 'flydrive';
import type { FileItem } from '../types/drive';
import { DriveService } from './DriveService';
import { StorageService } from './StorageService';

/**
 * Sanitizes a file name by replacing characters that are not alphanumeric,
 * hyphens, underscores, exclamation marks, dots, or spaces with underscores.
 * @param name - The original file name to sanitize.
 * @returns The sanitized file name safe for storage.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9\-_!.\s]/g, '_');
}

/** Maximum file size allowed for preview, in bytes (200 MB). */
const MAX_PREVIEW_SIZE = 200 * 1024 * 1024;

@Service()
export class FileService {
  constructor(
    private driveService: DriveService,
    private storageService: StorageService,
  ) {}

  /**
   * Resolves a drive ID to a flydrive `Disk` instance.
   * @param driveId - The unique identifier of the drive.
   * @returns The configured `Disk` instance, or `null` if the drive was not found.
   */
  getDrive(driveId: string): Drive | null {
    const drive = this.driveService.getById(driveId);
    if (!drive) return null;
    return this.storageService.createDrive(drive);
  }

  /**
   * Lists files and folders at the given path prefix (non-recursive).
   * Metadata (size, last modified) is fetched in parallel for file items.
   * @param drive - The storage drive instance to list from.
   * @param prefix - The directory path prefix to list. Use `""` for root.
   * @returns An object containing the path and an array of file/folder items.
   */
  async listFiles(drive: Drive, prefix: string): Promise<{ path: string; items: FileItem[] }> {
    const listing = await drive.listAll(prefix, { recursive: false });
    const { items, metaPromises } = this.mapListingToFileItems(listing.objects);
    await Promise.all(metaPromises);
    return { path: prefix, items };
  }

  /**
   * Uploads a file to the specified target path on the drive.
   * The file name is sanitized before storage.
   * @param drive - The storage drive instance to upload to.
   * @param targetPath - The directory path where the file should be placed. Use `""` for root.
   * @param file - The file object to upload.
   * @returns The full storage path of the uploaded file.
   */
  async upload(drive: Drive, targetPath: string, file: File): Promise<string> {
    const safeName = sanitizeFileName(file.name);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;
    const buffer = await file.arrayBuffer();
    await drive.put(filePath, new Uint8Array(buffer));
    return filePath;
  }

  /**
   * Downloads a single file from the drive.
   * @param drive - The storage drive instance to download from.
   * @param filePath - The full path of the file to download.
   * @returns An object containing the file bytes and the extracted file name.
   */
  async download(drive: Drive, filePath: string): Promise<{ bytes: Uint8Array; fileName: string }> {
    const bytes = await drive.getBytes(filePath);
    const fileName = filePath.split('/').pop() || 'file';
    return { bytes, fileName };
  }

  /**
   * Retrieves file content for in-browser preview with MIME type detection.
   * Enforces a maximum file size to prevent excessive memory usage.
   * @param drive - The storage drive instance to read from.
   * @param filePath - The full path of the file to preview.
   * @returns An object containing the file bytes and the resolved content type.
   * @throws {PreviewTooLargeError} If the file exceeds {@link MAX_PREVIEW_SIZE}.
   */
  async preview(
    drive: Drive,
    filePath: string,
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const meta = await drive.getMetaData(filePath);
    if (meta.contentLength > MAX_PREVIEW_SIZE) {
      throw new PreviewTooLargeError();
    }
    const bytes = await drive.getBytes(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentType = mime.getType(ext) || meta.contentType || 'application/octet-stream';
    return { bytes, contentType };
  }

  /**
   * Downloads an entire folder as a ZIP archive streamed through a PassThrough.
   * All files within the folder are recursively included; `.keep` marker files are excluded.
   * @param drive - The storage drive instance to read from.
   * @param folderPath - The path of the folder to download.
   * @returns An object containing the readable stream of the ZIP archive and the folder name.
   * @throws {EmptyFolderError} If the folder contains no files.
   */
  async downloadFolder(
    drive: Drive,
    folderPath: string,
  ): Promise<{ stream: PassThrough; folderName: string }> {
    const listing = await drive.listAll(folderPath, { recursive: true });
    const fileObjects = this.getFileObjects(listing.objects);

    if (fileObjects.length === 0) {
      throw new EmptyFolderError();
    }

    const folderName = folderPath
      ? folderPath.split('/').filter(Boolean).pop() || 'download'
      : 'download';

    const archive = archiver('zip', { zlib: { level: 5 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    for (const file of fileObjects) {
      const f = file as unknown as { key: string };
      const bytes = await drive.getBytes(f.key);
      const nameInZip = folderPath ? f.key.slice(folderPath.length).replace(/^\//, '') : f.key;
      archive.append(Buffer.from(bytes), { name: nameInZip });
    }

    archive.finalize();
    return { stream: passthrough, folderName };
  }

  /**
   * Deletes a file or directory from the drive.
   * For directories, all contents are recursively removed.
   * @param drive - The storage drive instance.
   * @param filePath - The path of the item to delete.
   * @param isDirectory - Whether the item is a directory.
   */
  async deleteItem(drive: Drive, filePath: string, isDirectory: boolean): Promise<void> {
    if (isDirectory) {
      await drive.deleteAll(filePath);
    } else {
      await drive.delete(filePath);
    }
  }

  /**
   * Creates an empty folder by writing a `.keep` marker file inside it.
   * @param drive - The storage drive instance.
   * @param folderPath - The path of the folder to create.
   */
  async createFolder(drive: Drive, folderPath: string): Promise<void> {
    await drive.put(`${folderPath}/.keep`, new Uint8Array(0));
  }

  /**
   * Renames a file or directory by moving its contents to a new path.
   * Handles case-only renames (e.g., "Docs" to "docs") specially, since some
   * filesystems treat them as the same path.
   * @param drive - The storage drive instance.
   * @param oldPath - The current path of the item.
   * @param newName - The new name for the item (just the name, not the full path).
   * @param isDirectory - Whether the item is a directory.
   * @returns The new full path after renaming.
   */
  async rename(
    drive: Drive,
    oldPath: string,
    newName: string,
    isDirectory: boolean,
  ): Promise<string> {
    const parts = oldPath.split('/').filter(Boolean);
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    const isCaseOnlyRename = oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath;

    if (isDirectory) {
      await this.renameDirectory(drive, oldPath, newPath, isCaseOnlyRename);
    } else {
      await this.renameFile(drive, oldPath, newPath, isCaseOnlyRename);
    }

    return newPath;
  }

  /**
   * Renames a directory by moving all its contents to a new path.
   * For case-only renames, files are buffered in memory, the old directory is deleted,
   * then files are re-written to avoid filesystem conflicts.
   * @param drive - The storage drive instance.
   * @param oldPath - The current directory path.
   * @param newPath - The target directory path.
   * @param isCaseOnly - Whether this is a case-only rename.
   */
  private async renameDirectory(
    drive: Drive,
    oldPath: string,
    newPath: string,
    isCaseOnly: boolean,
  ) {
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
      try {
        await drive.deleteAll(oldPath);
      } catch (_err) {
        console.warn('Failed to clean up old directory after rename:', oldPath);
      }
    }
  }

  /**
   * Renames a single file. For case-only renames, the file content is read,
   * the original is deleted, then re-written under the new name.
   * @param drive - The storage drive instance.
   * @param oldPath - The current file path.
   * @param newPath - The target file path.
   * @param isCaseOnly - Whether this is a case-only rename.
   */
  private async renameFile(drive: Drive, oldPath: string, newPath: string, isCaseOnly: boolean) {
    if (isCaseOnly) {
      const bytes = await drive.getBytes(oldPath);
      await drive.delete(oldPath);
      await drive.put(newPath, bytes);
    } else {
      await drive.move(oldPath, newPath);
    }
  }

  /**
   * Searches for files and folders whose names contain the query string (case-insensitive).
   * Paginates through all items in the drive recursively.
   * @param drive - The storage drive instance to search.
   * @param query - The search query to match against file and folder names.
   * @returns An array of matching file and folder items with metadata.
   */
  async search(drive: Drive, query: string): Promise<FileItem[]> {
    const lowerQuery = query.toLowerCase();
    const nameFilter = (name: string) => name.toLowerCase().includes(lowerQuery);
    const allItems: FileItem[] = [];
    const allMetaPromises: Promise<void>[] = [];

    let paginationToken: string | undefined;
    do {
      const listing = await (drive as any).listAll('', { recursive: true, paginationToken });
      const { items, metaPromises } = this.mapListingToFileItems(listing.objects, nameFilter);
      allItems.push(...items);
      allMetaPromises.push(...metaPromises);
      paginationToken = listing.paginationToken;
    } while (paginationToken);

    await Promise.all(allMetaPromises);
    return allItems;
  }

  /**
   * Maps raw listing objects from flydrive into structured {@link FileItem} arrays.
   * Skips `.keep` marker files and optionally filters items by name.
   * Metadata fetching for files is deferred via promises for parallel execution.
   * @param objects - The iterable of raw listing objects from the storage driver.
   * @param filter - An optional predicate to filter items by name.
   * @returns An object containing the mapped items and an array of metadata promises to await.
   */
  private mapListingToFileItems(
    objects: Iterable<any>,
    filter?: (name: string) => boolean,
  ): { items: FileItem[]; metaPromises: Promise<void>[] } {
    const items: FileItem[] = [];
    const metaPromises: Promise<void>[] = [];

    for (const item of objects) {
      if (item.isFile) {
        if (item.name === '.keep') continue;
        if (filter && !filter(item.name)) continue;
        const fileItem: FileItem = { name: item.name, path: item.key, isDirectory: false };
        items.push(fileItem);
        metaPromises.push(
          item
            .getMetaData()
            .then((meta: any) => {
              fileItem.size = meta.contentLength;
              fileItem.lastModified = meta.lastModified.toISOString();
            })
            .catch(() => {}),
        );
      } else {
        if (filter && !filter(item.name)) continue;
        items.push({ name: item.name, path: item.prefix, isDirectory: true });
      }
    }

    return { items, metaPromises };
  }

  /**
   * Filters listing objects to include only actual files, excluding `.keep` marker files.
   * @param objects - The iterable of raw listing objects from the storage driver.
   * @returns An array of file objects with `.keep` files removed.
   */
  private getFileObjects(objects: Iterable<any>) {
    return [...objects].filter((item) => item.isFile && item.name !== '.keep');
  }
}

/**
 * Error thrown when a file requested for preview exceeds the maximum allowed size.
 * @see {@link MAX_PREVIEW_SIZE}
 */
export class PreviewTooLargeError extends Error {
  constructor() {
    super('File too large for preview');
  }
}

/**
 * Error thrown when attempting to download a folder that contains no files.
 */
export class EmptyFolderError extends Error {
  constructor() {
    super('Folder is empty');
  }
}
