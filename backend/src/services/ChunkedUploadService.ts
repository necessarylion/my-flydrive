import { join } from "node:path";
import { mkdir, rm, appendFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { AzureDriver } from "flydrive-azure";
import type { DriveConfig, AzureConfig } from "../types/drive";
import type { StorageService } from "./StorageService";

function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9\-_!.\s]/g, "_");
}

const CHUNKS_DIR = join(import.meta.dir, "../../tmp/chunks");

interface AzureUploadState {
  type: "azure";
  filePath: string;
  blockIds: Map<number, string>;
  driver: AzureDriver;
}

interface LocalUploadState {
  type: "local";
  filePath: string;
}

type UploadState = AzureUploadState | LocalUploadState;

export class ChunkedUploadService {
  private uploads = new Map<string, UploadState>();

  constructor(private storageService: StorageService) {}

  async stageChunk(
    driveConfig: DriveConfig,
    uploadId: string,
    chunkIndex: number,
    data: Buffer,
    fileName: string,
    targetPath: string,
  ): Promise<void> {
    if (driveConfig.type !== "azure" && driveConfig.type !== "local") {
      throw new Error("Chunked upload is only supported for Azure and Local drives. Please use smaller files for other drive types.");
    }

    const safeName = sanitizeFileName(fileName);
    const filePath = targetPath ? `${targetPath}/${safeName}` : safeName;

    let state = this.uploads.get(uploadId);
    if (!state) {
      state = this.createState(driveConfig, filePath);
      this.uploads.set(uploadId, state);
    }

    switch (state.type) {
      case "azure": {
        const blockId = Buffer.from(String(chunkIndex).padStart(6, "0")).toString("base64");
        await state.driver.putBlock(state.filePath, blockId, data, data.length);
        state.blockIds.set(chunkIndex, blockId);
        break;
      }
      case "local": {
        const dir = join(CHUNKS_DIR, uploadId);
        await mkdir(dir, { recursive: true });
        await Bun.write(join(dir, String(chunkIndex)), data);
        break;
      }
    }
  }

  async complete(
    driveConfig: DriveConfig,
    uploadId: string,
    totalChunks: number,
  ): Promise<string> {
    const state = this.uploads.get(uploadId);
    if (!state) {
      throw new Error("Upload not found");
    }

    try {
      switch (state.type) {
        case "azure": {
          const blockIds: string[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const blockId = state.blockIds.get(i);
            if (!blockId) throw new Error(`Missing block ${i}`);
            blockIds.push(blockId);
          }
          await state.driver.commitBlockList(state.filePath, blockIds);
          return state.filePath;
        }
        case "local": {
          const dir = join(CHUNKS_DIR, uploadId);
          const mergedPath = join(dir, "_merged");
          try {
            for (let i = 0; i < totalChunks; i++) {
              const chunkBytes = await Bun.file(join(dir, String(i))).arrayBuffer();
              await appendFile(mergedPath, Buffer.from(chunkBytes));
            }
            const disk = this.storageService.createDisk(driveConfig);
            const stream = createReadStream(mergedPath);
            await disk.putStream(state.filePath, stream);
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

  private createState(driveConfig: DriveConfig, filePath: string): UploadState {
    switch (driveConfig.type) {
      case "azure": {
        const cfg = driveConfig.config as AzureConfig;
        const driver = new AzureDriver({
          connectionString: cfg.connectionString,
          container: cfg.container,
        });
        return { type: "azure", filePath, blockIds: new Map(), driver };
      }
      case "local":
        return { type: "local", filePath };
      default:
        throw new Error("Unsupported drive type for chunked upload");
    }
  }
}
