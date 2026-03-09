import { Service } from 'typedi';
import { join } from 'node:path';
import { mkdir, rm, appendFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { AzureDriver } from 'flydrive-azure';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import type { DriveConfig, AzureConfig, S3Config, GCSConfig } from '../types/drive';
import { StorageService } from './StorageService';
import { CHUNKS_DIR, DriveType } from '../constants';

/**
 * Sanitizes a file name by replacing characters that are not alphanumeric,
 * hyphens, underscores, exclamation marks, dots, or spaces with underscores.
 * @param name - The original file name to sanitize.
 * @returns The sanitized file name safe for storage.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9\-_!.\s]/g, '_');
}

/**
 * Tracks the state of an in-progress Azure chunked upload.
 * Uses Azure block blob API to stage individual blocks and commit them.
 */
interface AzureUploadState {
  type: DriveType.Azure;
  /** The target file path in the storage container. */
  filePath: string;
  /** Maps chunk indices to their base64-encoded block IDs. */
  blockIds: Map<number, string>;
  /** The Azure driver instance used for block operations. */
  driver: AzureDriver;
}

/**
 * Tracks the state of an in-progress S3 chunked upload.
 * Uses S3 multipart upload API to upload parts and complete the upload.
 */
interface S3UploadState {
  type: DriveType.S3;
  /** The target file key in the S3 bucket. */
  filePath: string;
  /** The S3 bucket name. */
  bucket: string;
  /** The multipart upload ID returned by S3. */
  uploadId: string;
  /** Maps chunk indices to their ETags returned by S3. */
  parts: Map<number, string>;
  /** The S3 client instance used for multipart operations. */
  client: S3Client;
}

/**
 * Tracks the state of an in-progress GCS chunked upload.
 * Uses GCS resumable upload API to upload chunks directly without local staging.
 */
interface GCSUploadState {
  type: DriveType.GCS;
  /** The target file path in the GCS bucket. */
  filePath: string;
  /** The resumable upload URI returned by GCS. */
  resumableUri: string;
  /** Total bytes uploaded so far, used for Content-Range offset. */
  bytesUploaded: number;
  /** Maps chunk indices to their data, used to buffer out-of-order chunks. */
  pendingChunks: Map<number, Buffer>;
  /** The next expected chunk index to upload. */
  nextChunkIndex: number;
}

/**
 * Tracks the state of an in-progress local filesystem chunked upload.
 * Chunks are written to a temporary directory and merged on completion.
 */
interface LocalUploadState {
  type: DriveType.Local;
  /** The target file path in the local storage root. */
  filePath: string;
}

/** Discriminated union of all supported upload state types. */
type UploadState = AzureUploadState | S3UploadState | GCSUploadState | LocalUploadState;

@Service()
export class ChunkedUploadService {
  private uploads = new Map<string, UploadState>();

  constructor(private storageService: StorageService) {}

  /**
   * Stages a single chunk of a multipart upload.
   * - Azure: uploads the chunk as a block via the block blob API.
   * - S3: uploads the chunk as a part via the multipart upload API.
   * - GCS: buffers the chunk and flushes in-order chunks via the resumable upload URI.
   * - Local: writes the chunk to a temporary file on disk.
   *
   * @param driveConfig - The drive configuration for the target storage.
   * @param uploadId - A unique identifier for this upload session.
   * @param chunkIndex - The zero-based index of this chunk.
   * @param data - The chunk data as a Buffer.
   * @param fileName - The original file name (will be sanitized).
   * @param targetPath - The directory path where the final file should be placed. Use `""` for root.
   * @throws {Error} If the drive type does not support chunked uploads.
   */
  async stageChunk(
    driveConfig: DriveConfig,
    uploadId: string,
    chunkIndex: number,
    data: Buffer,
    fileName: string,
    targetPath: string,
    totalChunks?: number,
  ): Promise<void> {
    const safeName = sanitizeFileName(fileName);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;

    let state = this.uploads.get(uploadId);
    if (!state) {
      state = await this.createState(driveConfig, filePath);
      this.uploads.set(uploadId, state);
    }

    switch (state.type) {
      case DriveType.Azure: {
        const blockId = Buffer.from(String(chunkIndex).padStart(6, '0')).toString('base64');
        await state.driver.putBlock(state.filePath, blockId, data, data.length);
        state.blockIds.set(chunkIndex, blockId);
        break;
      }
      case DriveType.S3: {
        const result = await state.client.send(
          new UploadPartCommand({
            Bucket: state.bucket,
            Key: state.filePath,
            UploadId: state.uploadId,
            PartNumber: chunkIndex + 1, // S3 parts are 1-indexed
            Body: data,
          }),
        );
        state.parts.set(chunkIndex, result.ETag!);
        break;
      }
      case DriveType.GCS: {
        state.pendingChunks.set(chunkIndex, data);
        await this.flushGCSChunks(state, totalChunks);
        break;
      }
      case DriveType.Local: {
        const dir = join(CHUNKS_DIR, uploadId);
        await mkdir(dir, { recursive: true });
        await Bun.write(join(dir, String(chunkIndex)), data);
        break;
      }
    }
  }

  /**
   * Completes a chunked upload by assembling all staged chunks into the final file.
   * - Azure: commits the block list to finalize the blob.
   * - S3: completes the multipart upload with all part ETags.
   * - GCS: flushes any remaining buffered chunks via the resumable upload URI to finalize.
   * - Local: merges chunk files sequentially and uploads the result to the drive.
   * Cleans up temporary state and files after completion.
   *
   * @param driveConfig - The drive configuration for the target storage.
   * @param uploadId - The unique identifier of the upload session to complete.
   * @param totalChunks - The total number of chunks that were staged.
   * @returns The final storage path of the uploaded file.
   * @throws {Error} If the upload ID is not found or a chunk is missing.
   */
  async complete(driveConfig: DriveConfig, uploadId: string, totalChunks: number): Promise<string> {
    const state = this.uploads.get(uploadId);
    if (!state) {
      throw new Error('Upload not found');
    }

    try {
      switch (state.type) {
        case DriveType.Azure: {
          const blockIds: string[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const blockId = state.blockIds.get(i);
            if (!blockId) throw new Error(`Missing block ${i}`);
            blockIds.push(blockId);
          }
          await state.driver.commitBlockList(state.filePath, blockIds);
          return state.filePath;
        }
        case DriveType.S3: {
          const parts: { ETag: string; PartNumber: number }[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const etag = state.parts.get(i);
            if (!etag) throw new Error(`Missing part ${i}`);
            parts.push({ ETag: etag, PartNumber: i + 1 });
          }
          await state.client.send(
            new CompleteMultipartUploadCommand({
              Bucket: state.bucket,
              Key: state.filePath,
              UploadId: state.uploadId,
              MultipartUpload: { Parts: parts },
            }),
          );
          return state.filePath;
        }
        case DriveType.GCS: {
          await this.flushGCSChunks(state, totalChunks);
          if (state.nextChunkIndex < totalChunks) {
            throw new Error(`Missing GCS chunk ${state.nextChunkIndex}`);
          }
          return state.filePath;
        }
        case DriveType.Local: {
          const dir = join(CHUNKS_DIR, uploadId);
          const mergedPath = join(dir, '_merged');
          try {
            for (let i = 0; i < totalChunks; i++) {
              const chunkBytes = await Bun.file(join(dir, String(i))).arrayBuffer();
              await appendFile(mergedPath, Buffer.from(chunkBytes));
            }
            const drive = this.storageService.createDrive(driveConfig);
            const stream = createReadStream(mergedPath);
            await drive.putStream(state.filePath, stream);
          } finally {
            await rm(dir, { recursive: true, force: true }).catch(() => {});
          }
          return state.filePath;
        }
      }
    } finally {
      this.uploads.delete(uploadId);
    }
  }

  /**
   * Creates the initial upload state for a new chunked upload session.
   * - Azure: instantiates an AzureDriver for block blob operations.
   * - S3: creates an S3Client and initiates a multipart upload to obtain an upload ID.
   * - GCS: creates a Storage instance and initiates a resumable upload to obtain a URI.
   * - Local: returns a minimal state with just the target file path.
   *
   * @param driveConfig - The drive configuration determining the upload strategy.
   * @param filePath - The target file path in storage.
   * @returns The initialized upload state for the given drive type.
   * @throws {Error} If the drive type does not support chunked uploads.
   */
  private async createState(driveConfig: DriveConfig, filePath: string): Promise<UploadState> {
    switch (driveConfig.type) {
      case DriveType.Azure: {
        const cfg = driveConfig.config as AzureConfig;
        const driver = new AzureDriver({
          connectionString: cfg.connectionString,
          container: cfg.container,
        });
        return { type: DriveType.Azure, filePath, blockIds: new Map(), driver };
      }
      case DriveType.S3: {
        const cfg = driveConfig.config as S3Config;
        const client = new S3Client({
          credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
          region: cfg.region,
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        });
        const { UploadId } = await client.send(
          new CreateMultipartUploadCommand({ Bucket: cfg.bucket, Key: filePath }),
        );
        if (!UploadId) throw new Error('Failed to initiate S3 multipart upload');
        return {
          type: DriveType.S3,
          filePath,
          bucket: cfg.bucket,
          uploadId: UploadId,
          parts: new Map(),
          client,
        };
      }
      case DriveType.GCS: {
        const cfg = driveConfig.config as GCSConfig;
        const storage = new Storage({
          ...(cfg.credentials ? { credentials: JSON.parse(cfg.credentials) } : {}),
        });
        const file = storage.bucket(cfg.bucket).file(filePath);
        const [resumableUri] = await file.createResumableUpload({
          metadata: { contentType: 'application/octet-stream' },
        });
        return {
          type: DriveType.GCS,
          filePath,
          resumableUri,
          bytesUploaded: 0,
          pendingChunks: new Map(),
          nextChunkIndex: 0,
        };
      }
      case DriveType.Local:
        return { type: DriveType.Local, filePath };
      default:
        throw new Error('Unsupported drive type for chunked upload');
    }
  }

  /**
   * Flushes buffered GCS chunks sequentially via the resumable upload URI.
   * Uploads chunks in order starting from `nextChunkIndex`. If a chunk is missing,
   * stops and waits for it to arrive. On the final flush (when totalChunks is provided),
   * the last chunk is sent with a finalized Content-Range to complete the upload.
   */
  private async flushGCSChunks(state: GCSUploadState, totalChunks?: number): Promise<void> {
    while (state.pendingChunks.has(state.nextChunkIndex)) {
      const chunk = state.pendingChunks.get(state.nextChunkIndex)!;
      state.pendingChunks.delete(state.nextChunkIndex);

      const start = state.bytesUploaded;
      const end = start + chunk.length - 1;
      const isLast = totalChunks !== undefined && state.nextChunkIndex === totalChunks - 1;
      const total = isLast ? String(end + 1) : '*';

      const res = await fetch(state.resumableUri, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${total}`,
        },
        body: chunk,
      });

      // 200/201 = upload complete, 308 = upload incomplete (continue)
      if (!res.ok && res.status !== 308) {
        const body = await res.text();
        throw new Error(`GCS resumable upload failed (${res.status}): ${body}`);
      }

      state.bytesUploaded += chunk.length;
      state.nextChunkIndex++;
    }
  }
}
