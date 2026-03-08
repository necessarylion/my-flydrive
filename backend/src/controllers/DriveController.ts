import { Hono } from "hono";
import type { DriveService } from "../services/DriveService";

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
    return c.json(drive);
  }

  private async create(c: any) {
    const body = await c.req.json();
    const drive = this.driveService.create(body);
    return c.json(drive, 201);
  }

  private async update(c: any) {
    const id = c.req.param("id");
    const body = await c.req.json();
    const updated = this.driveService.update(id, body);
    if (!updated) return c.json({ error: "Drive not found" }, 404);
    return c.json(updated);
  }

  private remove(c: any) {
    const id = c.req.param("id");
    const deleted = this.driveService.delete(id);
    if (!deleted) return c.json({ error: "Drive not found" }, 404);
    return c.json({ message: "Drive deleted" });
  }
}
