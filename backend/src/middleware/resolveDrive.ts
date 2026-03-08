import Container from 'typedi';
import { DriveService } from '../services/DriveService';
import { FileService } from '../services/FileService';
import type { DriveEnv } from '../controllers/FileController';
import type { Context, Next } from 'hono';

/**
 * Hono middleware that extracts the `:driveId` route parameter, looks up the
 * corresponding drive configuration and flydrive Disk instance, and attaches
 * them to the request context. Returns a 404 response if the drive is not found.
 *
 * @param c - The Hono request context with {@link DriveEnv} environment bindings.
 * @param next - The next middleware or route handler.
 * @returns A 404 JSON response if the drive does not exist, otherwise proceeds to next.
 */
export async function resolveDrive(c: Context<DriveEnv>, next: Next) {
  const driveId = c.req.param('driveId') as string;
  const driveService = Container.get(DriveService);
  const fileService = Container.get(FileService);
  const driveConfig = driveService.getById(driveId);
  if (!driveConfig) return c.json({ error: 'Drive not found' }, 404);
  const drive = fileService.getDrive(driveId);
  if (!drive) return c.json({ error: 'Drive not found' }, 404);
  c.set('drive', drive);
  c.set('driveConfig', driveConfig);
  await next();
}
