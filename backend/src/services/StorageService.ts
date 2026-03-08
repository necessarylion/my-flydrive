import { Service } from 'typedi';
import { Disk as Drive } from 'flydrive';
import { FSDriver } from 'flydrive/drivers/fs';
import { S3Driver } from 'flydrive/drivers/s3';
import { GCSDriver } from 'flydrive/drivers/gcs';
import { AzureDriver } from 'flydrive-azure';

import type { DriveConfig, LocalConfig, S3Config, GCSConfig, AzureConfig } from '../types/drive';
import { DriveType } from '../constants';

@Service()
export class StorageService {
  /**
   * Creates a flydrive `Disk` instance configured for the specified storage provider.
   *
   * Supported provider types:
   * - `"local"` - Local filesystem via `FSDriver`
   * - `"s3"` - AWS S3 or S3-compatible storage via `S3Driver`
   * - `"gcs"` - Google Cloud Storage via `GCSDriver`
   * - `"azure"` - Azure Blob Storage via `AzureDriver`
   *
   * @param driveConfig - The drive configuration containing provider type and credentials.
   * @returns A configured `Disk` instance ready for file operations.
   * @throws {Error} If the drive type is not supported.
   */
  createDrive(driveConfig: DriveConfig): Drive {
    switch (driveConfig.type) {
      case DriveType.Local: {
        const cfg = driveConfig.config as LocalConfig;
        return new Drive(new FSDriver({ location: cfg.root, visibility: 'public' }));
      }
      case DriveType.S3: {
        const cfg = driveConfig.config as S3Config;
        return new Drive(
          new S3Driver({
            credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
            region: cfg.region,
            bucket: cfg.bucket,
            ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
            visibility: 'public',
          }),
        );
      }
      case DriveType.GCS: {
        const cfg = driveConfig.config as GCSConfig;
        return new Drive(
          new GCSDriver({
            bucket: cfg.bucket,
            ...(cfg.keyFilename ? { keyFilename: cfg.keyFilename } : {}),
            visibility: 'public',
          }),
        );
      }
      case DriveType.Azure: {
        const cfg = driveConfig.config as AzureConfig;
        return new Drive(
          new AzureDriver({ connectionString: cfg.connectionString, container: cfg.container }),
        );
      }
      default:
        throw new Error(`Unsupported drive type: ${driveConfig.type}`);
    }
  }
}
