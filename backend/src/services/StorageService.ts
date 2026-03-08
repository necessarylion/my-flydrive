import { Service } from "typedi";
import { Disk as Drive } from "flydrive";
import { FSDriver } from "flydrive/drivers/fs";
import { S3Driver } from "flydrive/drivers/s3";
import { GCSDriver } from "flydrive/drivers/gcs";
import { AzureDriver } from "flydrive-azure";

import type { DriveConfig, LocalConfig, S3Config, GCSConfig, AzureConfig } from "../types/drive";

@Service()
export class StorageService {
  createDrive(driveConfig: DriveConfig): Drive {
    switch (driveConfig.type) {
      case "local": {
        const cfg = driveConfig.config as LocalConfig;
        return new Drive(new FSDriver({ location: cfg.root, visibility: "public" }));
      }
      case "s3": {
        const cfg = driveConfig.config as S3Config;
        return new Drive(
          new S3Driver({
            credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
            region: cfg.region,
            bucket: cfg.bucket,
            ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
            visibility: "public",
          })
        );
      }
      case "gcs": {
        const cfg = driveConfig.config as GCSConfig;
        return new Drive(
          new GCSDriver({
            bucket: cfg.bucket,
            ...(cfg.keyFilename ? { keyFilename: cfg.keyFilename } : {}),
            visibility: "public",
          })
        );
      }
      case "azure": {
        const cfg = driveConfig.config as AzureConfig;
        return new Drive(new AzureDriver({ connectionString: cfg.connectionString, container: cfg.container }));
      }
      default:
        throw new Error(`Unsupported drive type: ${driveConfig.type}`);
    }
  }
}
