import { Hono } from "hono";
import type { DriveService } from "../services/DriveService";
import type { DriveConfig } from "../types/drive";
import { createDriveSchema, updateDriveSchema } from "../utils/validation";

function stripCredentials(drive: DriveConfig): Omit<DriveConfig, "config"> {
  const { config, ...rest } = drive;
  return rest;
}

export class DriveController {
  readonly routes = new Hono();

  constructor(private driveService: DriveService) {
    this.routes.get("/", this.list.bind(this));
    this.routes.get("/:id", this.getById.bind(this));
    this.routes.post("/", this.create.bind(this));
    this.routes.put("/:id", this.update.bind(this));
    this.routes.delete("/:id", this.remove.bind(this));
  }

  private list(c: any) {
    return c.json(this.driveService.listAll());
  }

  private getById(c: any) {
    const drive = this.driveService.getById(c.req.param("id"));
    if (!drive) return c.json({ error: "Drive not found" }, 404);
    return c.json(stripCredentials(drive));
  }

  private async create(c: any) {
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

  private async update(c: any) {
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

  private remove(c: any) {
    const id = c.req.param("id");
    const deleted = this.driveService.delete(id);
    if (!deleted) return c.json({ error: "Drive not found" }, 404);
    return c.json({ message: "Drive deleted" });
  }
}
