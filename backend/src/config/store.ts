import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { DriveConfig } from '../types/drive';

/** Absolute path to the data directory where the JSON store file lives. */
const DATA_DIR = join(import.meta.dir, '../../data');

/** Absolute path to the drives JSON store file. */
const STORE_FILE = join(DATA_DIR, 'drives.json');

/**
 * Ensures the data directory exists, creating it recursively if necessary.
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Reads and returns all drive configurations from the JSON store.
 *
 * @returns An array of all stored drive configurations, or an empty array
 *          if the store file does not yet exist.
 */
export function getDrives(): DriveConfig[] {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) {
    return [];
  }
  const raw = readFileSync(STORE_FILE, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Writes the given array of drive configurations to the JSON store,
 * replacing all existing data.
 *
 * @param drives - The complete array of drive configurations to persist.
 */
export function saveDrives(drives: DriveConfig[]) {
  ensureDataDir();
  writeFileSync(STORE_FILE, JSON.stringify(drives, null, 2));
}

/**
 * Finds and returns a single drive configuration by its unique ID.
 *
 * @param id - The unique identifier of the drive to look up.
 * @returns The matching drive configuration, or `undefined` if not found.
 */
export function getDriveById(id: string): DriveConfig | undefined {
  return getDrives().find((d) => d.id === id);
}

/**
 * Adds a new drive configuration to the store.
 *
 * If the new drive is marked as the default, all existing drives
 * have their `isDefault` flag cleared first.
 *
 * @param drive - The drive configuration to add.
 */
export function addDrive(drive: DriveConfig) {
  const drives = getDrives();
  if (drive.isDefault) {
    drives.forEach((d) => (d.isDefault = false));
  }
  drives.push(drive);
  saveDrives(drives);
}

/**
 * Updates an existing drive configuration with partial changes.
 *
 * Performs a deep merge on the `config` property, ignoring null, undefined,
 * and empty-string values so that only explicitly provided fields are overwritten.
 * If `isDefault` is set to `true`, all other drives are cleared as default first.
 * The `updatedAt` timestamp is automatically set to the current time.
 *
 * @param id - The unique identifier of the drive to update.
 * @param updates - A partial drive configuration containing the fields to change.
 * @returns The updated drive configuration, or `null` if no drive with the given ID exists.
 */
export function updateDrive(id: string, updates: Partial<DriveConfig>) {
  const drives = getDrives();
  const idx = drives.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  if (updates.isDefault) {
    drives.forEach((d) => (d.isDefault = false));
  }
  const existing = drives[idx]!;

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
    id: existing.id,
    name: updates.name ?? existing.name,
    type: updates.type ?? existing.type,
    isDefault: updates.isDefault ?? existing.isDefault,
    config: mergedConfig,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  drives[idx] = updated;
  saveDrives(drives);
  return drives[idx];
}

/**
 * Deletes a drive configuration by its unique ID.
 *
 * @param id - The unique identifier of the drive to delete.
 * @returns `true` if the drive was found and deleted, `false` if no drive with the given ID exists.
 */
export function deleteDrive(id: string): boolean {
  const drives = getDrives();
  const filtered = drives.filter((d) => d.id !== id);
  if (filtered.length === drives.length) return false;
  saveDrives(filtered);
  return true;
}
