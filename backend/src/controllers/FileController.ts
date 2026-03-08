import { Service } from 'typedi';
import type { Context } from 'hono';
import type { Disk as Drive } from 'flydrive';
import { FileService, PreviewTooLargeError, EmptyFolderError } from '../services/FileService';
import { ChunkedUploadService } from '../services/ChunkedUploadService';
import type { DriveConfig } from '../types/drive';
import {
  assertSafePath,
  PathTraversalError,
  sanitizeContentDisposition,
  safeErrorMessage,
} from '../utils/validation';

/**
 * Hono environment type that provides the resolved storage drive and its
 * configuration as context variables, injected by the drive middleware.
 */
export type DriveEnv = { Variables: { drive: Drive; driveConfig: DriveConfig } };

@Service()
export class FileController {
  constructor(
    private fileService: FileService,
    private chunkedUploadService: ChunkedUploadService,
  ) {}

  /**
   * Lists files and folders at the given path within the drive.
   *
   * @param c - The Hono request context. Accepts optional query param `path` for the directory prefix.
   * @returns A JSON response with the list of files and folders, or an error response
   *   (400 for path traversal, 500 for other errors).
   */
  async list(c: Context<DriveEnv>) {
    const prefix = c.req.query('path') || '';
    try {
      if (prefix) assertSafePath(prefix);
      const result = await this.fileService.listFiles(c.get('drive'), prefix);
      return c.json(result);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Uploads a single file to the specified path within the drive.
   *
   * Expects a multipart form data request with a `file` field.
   *
   * @param c - The Hono request context. Accepts optional query param `path` for the target directory.
   * @returns A JSON response with the uploaded file path (status 201), or an error response
   *   (400 for missing file or path traversal, 500 for other errors).
   */
  async upload(c: Context<DriveEnv>) {
    const targetPath = c.req.query('path') || '';
    try {
      if (targetPath) assertSafePath(targetPath);
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'No file provided' }, 400);

      const filePath = await this.fileService.upload(c.get('drive'), targetPath, file);
      return c.json({ message: 'File uploaded', path: filePath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Uploads a single chunk as part of a chunked (multipart) file upload.
   *
   * Expects multipart form data with `chunk`, `uploadId`, `chunkIndex`, and `fileName` fields.
   * The chunk is staged temporarily until all chunks are assembled via {@link uploadComplete}.
   *
   * @param c - The Hono request context. Accepts optional query param `path` for the target directory.
   * @returns A JSON response confirming the chunk was uploaded, or an error response
   *   (400 for missing/invalid fields or path traversal, 500 for other errors).
   */
  async uploadChunk(c: Context<DriveEnv>) {
    try {
      const targetPath = c.req.query('path') || '';
      if (targetPath) assertSafePath(targetPath);
      const formData = await c.req.formData();
      const chunk = formData.get('chunk') as File | null;
      const uploadId = formData.get('uploadId') as string;
      const chunkIndex = formData.get('chunkIndex') as string;
      const fileName = formData.get('fileName') as string;
      if (!chunk || !uploadId || chunkIndex == null || !fileName) {
        return c.json({ error: 'chunk, uploadId, chunkIndex, and fileName are required' }, 400);
      }

      const idx = parseInt(chunkIndex);
      if (isNaN(idx) || idx < 0 || idx > 10000) {
        return c.json({ error: 'Invalid chunkIndex' }, 400);
      }

      const buffer = Buffer.from(await chunk.arrayBuffer());
      await this.chunkedUploadService.stageChunk(
        c.get('driveConfig'),
        uploadId,
        idx,
        buffer,
        fileName,
        targetPath,
      );
      return c.json({ message: 'Chunk uploaded' });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Completes a chunked upload by assembling all staged chunks into the final file.
   *
   * Expects a JSON body with `uploadId` and `totalChunks` fields. Validates that
   * all chunks are present before assembling.
   *
   * @param c - The Hono request context. Expects a JSON body with `uploadId` (string)
   *   and `totalChunks` (number, 1-10000).
   * @returns A JSON response with the final file path (status 201), or an error response
   *   (400 for invalid body/params, 500 for assembly errors).
   */
  async uploadComplete(c: Context<DriveEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    try {
      const { uploadId, totalChunks } = body;
      if (!uploadId || !totalChunks) {
        return c.json({ error: 'uploadId and totalChunks are required' }, 400);
      }
      if (typeof totalChunks !== 'number' || totalChunks < 1 || totalChunks > 10000) {
        return c.json({ error: 'Invalid totalChunks' }, 400);
      }
      const filePath = await this.chunkedUploadService.complete(
        c.get('driveConfig'),
        uploadId,
        totalChunks,
      );
      return c.json({ message: 'File uploaded', path: filePath }, 201);
    } catch (err: any) {
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Downloads a file from the drive as a binary stream.
   *
   * Returns the file with `application/octet-stream` content type and a
   * `Content-Disposition` header for the browser to prompt a save dialog.
   *
   * @param c - The Hono request context. Requires query param `path` specifying the file to download.
   * @returns A binary {@link Response} with download headers, or a JSON error response
   *   (400 for missing path or path traversal, 500 for other errors).
   */
  async download(c: Context<DriveEnv>) {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: 'Path is required' }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, fileName } = await this.fileService.download(c.get('drive'), filePath);
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': sanitizeContentDisposition(fileName),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Returns a file's contents with its actual content type for in-browser preview.
   *
   * Unlike {@link download}, this serves the file with its detected MIME type
   * so browsers can render it inline (e.g., images, PDFs).
   *
   * @param c - The Hono request context. Requires query param `path` specifying the file to preview.
   * @returns A {@link Response} with the appropriate content type, or a JSON error response
   *   (400 for path traversal, 413 if the file exceeds the preview size limit, 500 for other errors).
   */
  async preview(c: Context<DriveEnv>) {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: 'Path is required' }, 400);

    try {
      assertSafePath(filePath);
      const { bytes, contentType } = await this.fileService.preview(c.get('drive'), filePath);
      return new Response(bytes, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(bytes.length),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      if (err instanceof PreviewTooLargeError) return c.json({ error: err.message }, 413);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Downloads an entire folder as a ZIP archive.
   *
   * Streams the folder contents as a zip file with the folder name as the archive name.
   *
   * @param c - The Hono request context. Accepts optional query param `path` for the folder
   *   (defaults to the drive root).
   * @returns A streaming ZIP {@link Response}, or a JSON error response
   *   (400 for path traversal or empty folder, 500 for other errors).
   */
  async downloadFolder(c: Context<DriveEnv>) {
    const folderPath = c.req.query('path') || '';
    try {
      if (folderPath) assertSafePath(folderPath);
      const { stream, folderName } = await this.fileService.downloadFolder(
        c.get('drive'),
        folderPath,
      );
      return new Response(stream as any, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': sanitizeContentDisposition(`${folderName}.zip`),
        },
      });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      if (err instanceof EmptyFolderError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Deletes a file or folder from the drive.
   *
   * @param c - The Hono request context. Requires query param `path` and optional
   *   query param `isDirectory` (set to `"true"` for folder deletion).
   * @returns A JSON response with a success message, or an error response
   *   (400 for missing path or path traversal, 500 for other errors).
   */
  async remove(c: Context<DriveEnv>) {
    const filePath = c.req.query('path');
    const isDirectory = c.req.query('isDirectory') === 'true';
    if (!filePath) return c.json({ error: 'Path is required' }, 400);

    try {
      assertSafePath(filePath);
      await this.fileService.deleteItem(c.get('drive'), filePath, isDirectory);
      return c.json({ message: isDirectory ? 'Folder deleted' : 'File deleted' });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Creates a new empty folder at the specified path.
   *
   * Expects a JSON body with a `path` string field indicating the folder to create.
   *
   * @param c - The Hono request context. Expects a JSON body with `path` (string).
   * @returns A JSON response with the created folder path (status 201), or an error response
   *   (400 for invalid body or path traversal, 500 for other errors).
   */
  async createFolder(c: Context<DriveEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const folderPath = body.path;
    if (!folderPath || typeof folderPath !== 'string') {
      return c.json({ error: 'Path is required' }, 400);
    }

    try {
      assertSafePath(folderPath);
      await this.fileService.createFolder(c.get('drive'), folderPath);
      return c.json({ message: 'Folder created', path: folderPath }, 201);
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Renames a file or folder within the drive.
   *
   * Expects a JSON body with `path` (current path), `newName` (the new file/folder name),
   * and optional `isDirectory` flag. The new name must not contain path separators.
   *
   * @param c - The Hono request context. Expects a JSON body with `path`, `newName`,
   *   and optionally `isDirectory`.
   * @returns A JSON response with the old and new paths, or an error response
   *   (400 for invalid input or path traversal, 500 for other errors).
   */
  async rename(c: Context<DriveEnv>) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const { path: oldPath, newName, isDirectory } = body;

    if (!oldPath || !newName) return c.json({ error: 'path and newName are required' }, 400);
    if (newName.includes('/') || newName.includes('\\'))
      return c.json({ error: 'newName must not contain path separators' }, 400);
    if (newName === '..' || newName === '.') return c.json({ error: 'Invalid newName' }, 400);

    try {
      assertSafePath(oldPath);
      const newPath = await this.fileService.rename(c.get('drive'), oldPath, newName, isDirectory);
      return c.json({ message: 'Renamed successfully', oldPath, newPath });
    } catch (err: any) {
      if (err instanceof PathTraversalError) return c.json({ error: err.message }, 400);
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }

  /**
   * Searches for files and folders matching a query string within the drive.
   *
   * @param c - The Hono request context. Requires query param `q` with the search term.
   * @returns A JSON response with `{ query, items }` containing matching results,
   *   or an error response (400 if query is missing, 500 for other errors).
   */
  async search(c: Context<DriveEnv>) {
    const query = c.req.query('q');
    if (!query) return c.json({ error: "Query parameter 'q' is required" }, 400);

    try {
      const items = await this.fileService.search(c.get('drive'), query);
      return c.json({ query, items });
    } catch (err: any) {
      return c.json({ error: safeErrorMessage(err) }, 500);
    }
  }
}
