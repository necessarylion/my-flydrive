import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { getDrives, getDriveById, addDrive, updateDrive, deleteDrive } from "../config/store";
import type { DriveConfig } from "../types/drive";

const drives = new Hono();

// List all drives
drives.get("/", (c) => {
  const allDrives = getDrives();
  const safeDrives = allDrives.map(({ config, ...rest }) => ({
    ...rest,
    type: rest.type,
  }));
  return c.json(safeDrives);
});

// Get single drive
drives.get("/:id", (c) => {
  const drive = getDriveById(c.req.param("id"));
  if (!drive) return c.json({ error: "Drive not found" }, 404);
  return c.json(drive);
});

// Create drive
drives.post("/", async (c) => {
  const body = await c.req.json();
  const now = new Date().toISOString();
  const drive: DriveConfig = {
    id: uuid(),
    name: body.name,
    type: body.type,
    isDefault: body.isDefault ?? false,
    config: body.config,
    createdAt: now,
    updatedAt: now,
  };
  addDrive(drive);
  return c.json(drive, 201);
});

// Update drive
drives.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = updateDrive(id, body);
  if (!updated) return c.json({ error: "Drive not found" }, 404);
  return c.json(updated);
});

// Delete drive
drives.delete("/:id", (c) => {
  const id = c.req.param("id");
  const deleted = deleteDrive(id);
  if (!deleted) return c.json({ error: "Drive not found" }, 404);
  return c.json({ message: "Drive deleted" });
});

export default drives;
