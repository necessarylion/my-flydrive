import { Disk } from "flydrive";
import { FSDriver } from "flydrive/drivers/fs";
import { S3Driver } from "flydrive/drivers/s3";
import { GCSDriver } from "flydrive/drivers/gcs";
import { AzureDriver } from "flydrive-azure";
import { BlobServiceClient } from "@azure/storage-blob";
import type { DriveConfig, LocalConfig, S3Config, GCSConfig, AzureConfig, FileItem } from "../types/drive";

export function createDisk(driveConfig: DriveConfig): Disk {
  switch (driveConfig.type) {
    case "local": {
      const cfg = driveConfig.config as LocalConfig;
      return new Disk(
        new FSDriver({
          location: cfg.root,
          visibility: "public",
        })
      );
    }
    case "s3": {
      const cfg = driveConfig.config as S3Config;
      return new Disk(
        new S3Driver({
          credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
          },
          region: cfg.region,
          bucket: cfg.bucket,
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
          visibility: "public",
        })
      );
    }
    case "gcs": {
      const cfg = driveConfig.config as GCSConfig;
      return new Disk(
        new GCSDriver({
          bucket: cfg.bucket,
          ...(cfg.keyFilename ? { keyFilename: cfg.keyFilename } : {}),
          visibility: "public",
        })
      );
    }
    case "azure": {
      const cfg = driveConfig.config as AzureConfig;
      return new Disk(
        new AzureDriver({
          connectionString: cfg.connectionString,
          container: cfg.container,
        })
      );
    }
    default:
      throw new Error(`Unsupported drive type: ${driveConfig.type}`);
  }
}
