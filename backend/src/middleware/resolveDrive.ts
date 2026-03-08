import Container from "typedi";
import { DriveService } from "../services/DriveService";
import { FileService } from "../services/FileService";
import type { DriveEnv } from "../controllers/FileController";
import type { Context, Next } from "hono";

// Middleware to resolve drive for all file routes
export async function resolveDrive(c: Context<DriveEnv>, next: Next) {
  const driveId = c.req.param("driveId") as string;
  const driveService = Container.get(DriveService);
  const fileService = Container.get(FileService);
  const driveConfig = driveService.getById(driveId);
  if (!driveConfig) return c.json({ error: "Drive not found" }, 404);
  const drive = fileService.getDrive(driveId);
  if (!drive) return c.json({ error: "Drive not found" }, 404);
  c.set("drive", drive);
  c.set("driveConfig", driveConfig);
  await next();
}
