import { Service } from 'typedi';
import { DriveService } from '../services/DriveService';
import type { DriveConfig } from '../types/drive';
import { createDriveSchema, updateDriveSchema } from '../utils/validation';

/**
 * Removes the `config` property from a drive object to prevent sensitive
 * provider credentials (e.g., access keys, connection strings) from being
 * exposed in API responses.
 *
 * @param drive - The full drive configuration including provider credentials.
 * @returns The drive object without the `config` property.
 */
function stripCredentials(drive: DriveConfig): Omit<DriveConfig, 'config'> {
  const { config: _, ...rest } = drive;
  return rest;
}

@Service()
export class DriveController {
  constructor(private driveService: DriveService) {}

  /**
   * Lists all configured drives.
   *
   * @param c - The Hono request context.
   * @returns A JSON response containing an array of all drives.
   */
  list(c: any) {
    return c.json(this.driveService.listAll());
  }

  /**
   * Retrieves a single drive by its ID, with credentials stripped.
   *
   * @param c - The Hono request context. Expects route param `id`.
   * @returns A JSON response with the drive object (sans credentials),
   *   or a 404 error if the drive is not found.
   */
  getById(c: any) {
    const drive = this.driveService.getById(c.req.param('id'));
    if (!drive) return c.json({ error: 'Drive not found' }, 404);
    return c.json(stripCredentials(drive));
  }

  /**
   * Creates a new drive configuration.
   *
   * Parses and validates the request body against {@link createDriveSchema}.
   * On success, persists the drive and returns it with credentials stripped.
   *
   * @param c - The Hono request context. Expects a JSON body matching the create schema.
   * @returns A JSON response with the created drive (status 201),
   *   or a 400 error if the body is invalid.
   */
  async create(c: any) {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const result = createDriveSchema.safeParse(body);
    if (!result.success) {
      return c.json(
        {
          error: 'Invalid drive configuration',
          details: result.error.issues.map((i: any) => i.message),
        },
        400,
      );
    }

    const drive = this.driveService.create(result.data);
    return c.json(stripCredentials(drive), 201);
  }

  /**
   * Updates an existing drive configuration.
   *
   * Parses and validates the request body against {@link updateDriveSchema}.
   * On success, applies the partial update and returns the updated drive
   * with credentials stripped.
   *
   * @param c - The Hono request context. Expects route param `id` and a JSON body
   *   matching the update schema.
   * @returns A JSON response with the updated drive, or a 400 error if the body
   *   is invalid, or a 404 error if the drive is not found.
   */
  async update(c: any) {
    const id = c.req.param('id');
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const result = updateDriveSchema.safeParse(body);
    if (!result.success) {
      return c.json(
        {
          error: 'Invalid drive configuration',
          details: result.error.issues.map((i: any) => i.message),
        },
        400,
      );
    }

    const updated = this.driveService.update(id, result.data as Partial<DriveConfig>);
    if (!updated) return c.json({ error: 'Drive not found' }, 404);
    return c.json(stripCredentials(updated));
  }

  /**
   * Deletes a drive configuration by ID.
   *
   * @param c - The Hono request context. Expects route param `id`.
   * @returns A JSON response with a success message, or a 404 error
   *   if the drive is not found.
   */
  remove(c: any) {
    const id = c.req.param('id');
    const deleted = this.driveService.delete(id);
    if (!deleted) return c.json({ error: 'Drive not found' }, 404);
    return c.json({ message: 'Drive deleted' });
  }
}
