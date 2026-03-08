import { Service } from 'typedi';
import { join } from 'node:path';
import { mkdir, rm, appendFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { AzureDriver } from 'flydrive-azure';
import type { DriveConfig, AzureConfig } from '../types/drive';
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
 * Tracks the state of an in-progress local filesystem chunked upload.
 * Chunks are written to a temporary directory and merged on completion.
 */
interface LocalUploadState {
  type: DriveType.Local;
  /** The target file path in the local storage root. */
  filePath: string;
}

/** Discriminated union of all supported upload state types. */
type UploadState = AzureUploadState | LocalUploadState;

@Service()
export class ChunkedUploadService {
  private uploads = new Map<string, UploadState>();

  constructor(private storageService: StorageService) {}

  /**
   * Stages a single chunk of a multipart upload.
   * For Azure drives, the chunk is uploaded as a block blob block.
   * For local drives, the chunk is written to a temporary file on disk.
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
  ): Promise<void> {
    if (driveConfig.type !== DriveType.Azure && driveConfig.type !== DriveType.Local) {
      throw new Error(
        'Chunked upload is only supported for Azure and Local drives. Please use smaller files for other drive types.',
      );
    }

    const safeName = sanitizeFileName(fileName);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;

    let state = this.uploads.get(uploadId);
    if (!state) {
      state = this.createState(driveConfig, filePath);
      this.uploads.set(uploadId, state);
    }

    switch (state.type) {
      case DriveType.Azure: {
        const blockId = Buffer.from(String(chunkIndex).padStart(6, '0')).toString('base64');
        await state.driver.putBlock(state.filePath, blockId, data, data.length);
        state.blockIds.set(chunkIndex, blockId);
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
   * For Azure drives, commits the block list to finalize the blob.
   * For local drives, merges chunk files sequentially and uploads the result to the drive.
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
   * @param driveConfig - The drive configuration determining the upload strategy.
   * @param filePath - The target file path in storage.
   * @returns The initialized upload state for the given drive type.
   * @throws {Error} If the drive type does not support chunked uploads.
   */
  private createState(driveConfig: DriveConfig, filePath: string): UploadState {
    switch (driveConfig.type) {
      case DriveType.Azure: {
        const cfg = driveConfig.config as AzureConfig;
        const driver = new AzureDriver({
          connectionString: cfg.connectionString,
          container: cfg.container,
        });
        return { type: DriveType.Azure, filePath, blockIds: new Map(), driver };
      }
      case DriveType.Local:
        return { type: DriveType.Local, filePath };
      default:
        throw new Error('Unsupported drive type for chunked upload');
    }
  }
}
