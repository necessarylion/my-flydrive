import { join } from 'path';

/** Admin user email address, loaded from the {@link process.env.ADMIN_EMAIL} environment variable. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

/** Admin user password, loaded from the {@link process.env.ADMIN_PASSWORD} environment variable. */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

/** Secret key used to sign and verify JWT tokens, loaded from the {@link process.env.JWT_SECRET} environment variable. */
export const JWT_SECRET = process.env.JWT_SECRET!;

// --- Enums ---

/** Supported storage provider types. */
export enum DriveType {
  Local = 'local',
  S3 = 's3',
  GCS = 'gcs',
  Azure = 'azure',
}

// --- Path constants ---

/** Absolute path to the data directory where the JSON store file lives. */
export const DATA_DIR = join(import.meta.dir, '../../data');

/** Absolute path to the drives JSON store file. */
export const STORE_FILE = join(DATA_DIR, 'drives.json');

/** Temporary directory path where local chunks are staged before being merged. */
export const CHUNKS_DIR = join(import.meta.dir, '../../tmp/chunks');

// --- File filters ---

/** File names to exclude from listings, search results, and folder downloads. */
export const HIDDEN_FILES = new Set(['.keep', 'DS_Store']);

// --- Limits ---

/** Maximum file size allowed for preview, in bytes (200 MB). */
export const MAX_PREVIEW_SIZE = 200 * 1024 * 1024;

/** Maximum allowed request body size in bytes (10 GB). */
export const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024 * 1024;
