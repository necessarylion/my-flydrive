import { DriveType } from '../constants';

/**
 * Represents a configured storage drive, including its provider-specific settings
 * and metadata such as creation and update timestamps.
 */
export interface DriveConfig {
  /** Unique identifier for the drive. */
  id: string;
  /** Human-readable display name for the drive. */
  name: string;
  /** Storage provider type. */
  type: DriveType;
  /** Whether this drive is the default drive used for file operations. */
  isDefault: boolean;
  /** Provider-specific configuration (credentials, paths, buckets, etc.). */
  config: LocalConfig | S3Config | GCSConfig | AzureConfig;
  /** ISO 8601 timestamp of when the drive was created. */
  createdAt: string;
  /** ISO 8601 timestamp of the last update to the drive configuration. */
  updatedAt: string;
}

/**
 * Configuration for local filesystem storage.
 */
export interface LocalConfig {
  /** Absolute path to the root directory used for file storage. */
  root: string;
}

/**
 * Configuration for AWS S3 or S3-compatible storage providers.
 */
export interface S3Config {
  /** Name of the S3 bucket. */
  bucket: string;
  /** AWS region where the bucket is located. */
  region: string;
  /** AWS access key ID for authentication. */
  accessKeyId: string;
  /** AWS secret access key for authentication. */
  secretAccessKey: string;
  /** Optional custom endpoint URL for S3-compatible services (e.g., MinIO). */
  endpoint?: string;
}

/**
 * Configuration for Google Cloud Storage.
 */
export interface GCSConfig {
  /** Name of the GCS bucket. */
  bucket: string;
  /** Google Cloud project ID that owns the bucket. */
  projectId: string;
  /** Optional path to a service account key file for authentication. */
  keyFilename?: string;
  /** Optional inline service account credentials as a JSON string. */
  credentials?: string;
}

/**
 * Configuration for Azure Blob Storage.
 */
export interface AzureConfig {
  /** Azure Storage connection string containing account name and key. */
  connectionString: string;
  /** Name of the blob container within the storage account. */
  container: string;
}

/**
 * Represents a file or directory within a storage drive.
 */
export interface FileItem {
  /** File or directory name (without path). */
  name: string;
  /** Full path relative to the drive root. */
  path: string;
  /** Whether this item is a directory. */
  isDirectory: boolean;
  /** File size in bytes. Undefined for directories. */
  size?: number;
  /** ISO 8601 timestamp of the last modification. */
  lastModified?: string;
  /** MIME type of the file (e.g., `"image/png"`). Undefined for directories. */
  mimeType?: string;
}
