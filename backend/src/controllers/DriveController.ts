import { Service } from "typedi";
import { DriveService } from "../services/DriveService";
import type { DriveConfig } from "../types/drive";
import { createDriveSchema, updateDriveSchema } from "../utils/validation";

function stripCredentials(drive: DriveConfig): Omit<DriveConfig, "config"> {
  const { config, ...rest } = drive;
  return rest;
}

@Service()
export class DriveController {
  constructor(private driveService: DriveService) {}

  list(c: any) {
    return c.json(this.driveService.listAll());
  }

  getById(c: any) {
    const drive = this.driveService.getById(c.req.param("id"));
    if (!drive) return c.json({ error: "Drive not found" }, 404);
    return c.json(stripCredentials(drive));
  }

  async create(c: any) {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const result = createDriveSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid drive configuration", details: result.error.issues.map((i: any) => i.message) }, 400);
    }

    const drive = this.driveService.create(result.data);
    return c.json(stripCredentials(drive), 201);
  }

  async update(c: any) {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const result = updateDriveSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid drive configuration", details: result.error.issues.map((i: any) => i.message) }, 400);
    }

    const updated = this.driveService.update(id, result.data as Partial<DriveConfig>);
    if (!updated) return c.json({ error: "Drive not found" }, 404);
    return c.json(stripCredentials(updated));
  }

  remove(c: any) {
    const id = c.req.param("id");
    const deleted = this.driveService.delete(id);
    if (!deleted) return c.json({ error: "Drive not found" }, 404);
    return c.json({ message: "Drive deleted" });
  }
}
