import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { DriveConfig } from "../types/drive";

const DATA_DIR = join(import.meta.dir, "../../data");
const STORE_FILE = join(DATA_DIR, "drives.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDrives(): DriveConfig[] {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) {
    return [];
  }
  const raw = readFileSync(STORE_FILE, "utf-8");
  return JSON.parse(raw);
}

export function saveDrives(drives: DriveConfig[]) {
  ensureDataDir();
  writeFileSync(STORE_FILE, JSON.stringify(drives, null, 2));
}

export function getDriveById(id: string): DriveConfig | undefined {
  return getDrives().find((d) => d.id === id);
}

export function addDrive(drive: DriveConfig) {
  const drives = getDrives();
  if (drive.isDefault) {
    drives.forEach((d) => (d.isDefault = false));
  }
  drives.push(drive);
  saveDrives(drives);
}

export function updateDrive(id: string, updates: Partial<DriveConfig>) {
  const drives = getDrives();
  const idx = drives.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  if (updates.isDefault) {
    drives.forEach((d) => (d.isDefault = false));
  }
  const existing = drives[idx];

  // Deep merge config: only override fields that are explicitly provided (not null/undefined)
  let mergedConfig = existing.config;
  if (updates.config) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates.config)) {
      if (value != null && value !== '') {
        cleaned[key] = value;
      }
    }
    mergedConfig = { ...existing.config, ...cleaned };
  }

  // Only apply top-level fields that are explicitly provided
  const updated: DriveConfig = {
    ...existing,
    ...(updates.name != null && { name: updates.name }),
    ...(updates.type != null && { type: updates.type }),
    ...(updates.isDefault != null && { isDefault: updates.isDefault }),
    config: mergedConfig,
    updatedAt: new Date().toISOString(),
  };
  drives[idx] = updated;
  saveDrives(drives);
  return drives[idx];
}

export function deleteDrive(id: string): boolean {
  const drives = getDrives();
  const filtered = drives.filter((d) => d.id !== id);
  if (filtered.length === drives.length) return false;
  saveDrives(filtered);
  return true;
}
