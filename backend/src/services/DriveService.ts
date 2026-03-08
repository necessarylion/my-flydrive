import { Service } from 'typedi';
import { v4 as uuid } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import type { DriveConfig } from '../types/drive';
import { DATA_DIR, STORE_FILE } from '../constants';

@Service()
export class DriveService {
  /**
   * Lists all drives with their provider-specific configuration stripped out.
   * This prevents sensitive credentials from being exposed in list responses.
   * @returns An array of drive configurations without the `config` field.
   */
  listAll(): Omit<DriveConfig, 'config'>[] {
    return this.readStore().map(({ config: _, ...rest }) => rest);
  }

  /**
   * Retrieves a single drive configuration by ID, including its provider-specific config.
   * @param id - The unique identifier of the drive.
   * @returns The full drive configuration, or `undefined` if not found.
   */
  getById(id: string): DriveConfig | undefined {
    return this.readStore().find((d) => d.id === id);
  }

  /**
   * Creates a new drive configuration with an auto-generated ID and timestamps.
   * If marked as default, all existing drives have their `isDefault` flag cleared.
   * @param body - The drive creation payload.
   * @returns The newly created drive configuration.
   */
  create(body: {
    name: string;
    type: DriveConfig['type'];
    isDefault?: boolean;
    config: any;
  }): DriveConfig {
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
    const drives = this.readStore();
    if (drive.isDefault) {
      drives.forEach((d) => (d.isDefault = false));
    }
    drives.push(drive);
    this.writeStore(drives);
    return drive;
  }

  /**
   * Updates an existing drive configuration with partial changes.
   * Performs a deep merge on the `config` property, ignoring null, undefined,
   * and empty-string values. If `isDefault` is set to `true`, all other drives are cleared.
   * @param id - The unique identifier of the drive to update.
   * @param updates - A partial object with the fields to update.
   * @returns The updated drive configuration, or `null` if not found.
   */
  update(id: string, updates: Partial<DriveConfig>): DriveConfig | null {
    const drives = this.readStore();
    const idx = drives.findIndex((d) => d.id === id);
    if (idx === -1) return null;

    if (updates.isDefault) {
      drives.forEach((d) => (d.isDefault = false));
    }

    const existing = drives[idx]!;

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
    this.writeStore(drives);
    return updated;
  }

  /**
   * Deletes a drive configuration by ID.
   * @param id - The unique identifier of the drive to delete.
   * @returns `true` if the drive was found and deleted, `false` otherwise.
   */
  delete(id: string): boolean {
    const drives = this.readStore();
    const filtered = drives.filter((d) => d.id !== id);
    if (filtered.length === drives.length) return false;
    this.writeStore(filtered);
    return true;
  }

  /**
   * Reads all drive configurations from the JSON store file.
   * Creates the data directory if it doesn't exist.
   */
  private readStore(): DriveConfig[] {
    this.ensureDataDir();
    if (!existsSync(STORE_FILE)) return [];
    const raw = readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Writes the given drive configurations to the JSON store file.
   * @param drives - The complete array of drive configurations to persist.
   */
  private writeStore(drives: DriveConfig[]): void {
    this.ensureDataDir();
    writeFileSync(STORE_FILE, JSON.stringify(drives, null, 2));
  }

  /** Ensures the data directory exists, creating it if necessary. */
  private ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  }
}
