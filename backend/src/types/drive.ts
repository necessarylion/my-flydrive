export type DriveType = "local" | "s3" | "gcs" | "azure";

export interface DriveConfig {
  id: string;
  name: string;
  type: DriveType;
  isDefault: boolean;
  config: LocalConfig | S3Config | GCSConfig | AzureConfig;
  createdAt: string;
  updatedAt: string;
}

export interface LocalConfig {
  root: string;
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export interface GCSConfig {
  bucket: string;
  projectId: string;
  keyFilename?: string;
  credentials?: string;
}

export interface AzureConfig {
  connectionString: string;
  container: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: string;
  mimeType?: string;
}
