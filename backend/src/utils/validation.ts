import { z } from 'zod/v4';

/**
 * Validates that a file path doesn't contain path traversal sequences.
 * Throws an error if the path is unsafe.
 */
export function assertSafePath(path: string): void {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/');

  for (const segment of segments) {
    if (segment === '..') {
      throw new PathTraversalError();
    }
  }

  // Block absolute paths
  if (normalized.startsWith('/')) {
    throw new PathTraversalError();
  }

  // Block null bytes
  if (normalized.includes('\0')) {
    throw new PathTraversalError();
  }
}

/**
 * Error thrown when a file path contains unsafe traversal sequences,
 * absolute path prefixes, or null bytes.
 */
export class PathTraversalError extends Error {
  constructor() {
    super('Invalid path');
  }
}

/**
 * Sanitize a filename for use in Content-Disposition header.
 * Uses RFC 5987 encoding for non-ASCII characters and escapes dangerous chars.
 */
export function sanitizeContentDisposition(filename: string): string {
  // Remove any characters that could inject headers
  const safe = filename.replace(/[\r\n"]/g, '_');
  const encoded = encodeURIComponent(safe).replace(/'/g, '%27');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

/**
 * Sanitize error messages for client responses.
 * Never expose internal details.
 */
export function safeErrorMessage(err: unknown, fallback = 'Internal server error'): string {
  if (err instanceof PathTraversalError) return err.message;
  return fallback;
}

// --- Zod schemas for drive validation ---

/** Zod schema for local filesystem drive configuration. Requires a root directory path. */
const localConfigSchema = z.object({
  root: z.string().min(1),
});

/** Zod schema for AWS S3 (or S3-compatible) drive configuration. */
const s3ConfigSchema = z.object({
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  endpoint: z.string().optional(),
});

/** Zod schema for Google Cloud Storage drive configuration. */
const gcsConfigSchema = z.object({
  bucket: z.string().min(1),
  projectId: z.string().min(1),
  keyFilename: z.string().optional(),
  credentials: z.string().optional(),
});

/** Zod schema for Azure Blob Storage drive configuration. */
const azureConfigSchema = z.object({
  connectionString: z.string().min(1),
  container: z.string().min(1),
});

/** Zod schema for the supported storage provider types. */
export const driveTypeSchema = z.enum(['local', 's3', 'gcs', 'azure']);

/**
 * Zod schema for creating a new drive.
 * Accepts name, type, optional isDefault flag, and a provider-specific config object.
 * The `.transform()` step validates the config against the appropriate provider schema.
 */
export const createDriveSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: driveTypeSchema,
    isDefault: z.boolean().optional(),
    config: z.unknown(),
  })
  .transform((data) => {
    // Validate config based on type
    let config;
    switch (data.type) {
      case 'local':
        config = localConfigSchema.parse(data.config);
        break;
      case 's3':
        config = s3ConfigSchema.parse(data.config);
        break;
      case 'gcs':
        config = gcsConfigSchema.parse(data.config);
        break;
      case 'azure':
        config = azureConfigSchema.parse(data.config);
        break;
    }
    return { ...data, config };
  });

/** Zod schema for updating an existing drive. All fields are optional. */
export const updateDriveSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: driveTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  config: z.unknown().optional(),
});
