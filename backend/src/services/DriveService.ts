import { Service } from 'typedi';
import { v4 as uuid } from 'uuid';
import type { DriveConfig } from '../types/drive';
import { DRIVE_STORE } from '../container';

/**
 * Interface for the drive configuration persistence store.
 * Implementations handle reading and writing drive configs to a backing store
 * (e.g., JSON file, database).
 */
export interface IDriveStore {
  /** Retrieves all stored drive configurations. */
  getDrives(): DriveConfig[];

  /**
   * Retrieves a single drive configuration by its unique identifier.
   * @param id - The unique identifier of the drive.
   * @returns The matching drive configuration, or `undefined` if not found.
   */
  getDriveById(id: string): DriveConfig | undefined;

  /**
   * Persists a new drive configuration to the store.
   * @param drive - The complete drive configuration to add.
   */
  addDrive(drive: DriveConfig): void;

  /**
   * Updates an existing drive configuration with partial changes.
   * @param id - The unique identifier of the drive to update.
   * @param updates - A partial object containing the fields to update.
   * @returns The updated drive configuration, or `null` if the drive was not found.
   */
  updateDrive(id: string, updates: Partial<DriveConfig>): DriveConfig | null;

  /**
   * Removes a drive configuration from the store.
   * @param id - The unique identifier of the drive to delete.
   * @returns `true` if the drive was found and deleted, `false` otherwise.
   */
  deleteDrive(id: string): boolean;
}

@Service()
export class DriveService {
  constructor(private store: IDriveStore = DRIVE_STORE) {}

  /**
   * Lists all drives with their provider-specific configuration stripped out.
   * This prevents sensitive credentials from being exposed in list responses.
   * @returns An array of drive configurations without the `config` field.
   */
  listAll(): Omit<DriveConfig, 'config'>[] {
    return this.store.getDrives().map(({ config: _, ...rest }) => rest);
  }

  /**
   * Retrieves a single drive configuration by ID, including its provider-specific config.
   * @param id - The unique identifier of the drive.
   * @returns The full drive configuration, or `undefined` if not found.
   */
  getById(id: string): DriveConfig | undefined {
    return this.store.getDriveById(id);
  }

  /**
   * Creates a new drive configuration with an auto-generated ID and timestamps.
   * @param body - The drive creation payload.
   * @param body.name - Human-readable name for the drive.
   * @param body.type - The storage provider type (e.g., "local", "s3", "gcs", "azure").
   * @param body.isDefault - Whether this drive should be the default. Defaults to `false`.
   * @param body.config - Provider-specific configuration (credentials, paths, etc.).
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
    this.store.addDrive(drive);
    return drive;
  }

  /**
   * Updates an existing drive configuration.
   * @param id - The unique identifier of the drive to update.
   * @param updates - A partial object with the fields to update.
   * @returns The updated drive configuration, or `null` if the drive was not found.
   */
  update(id: string, updates: Partial<DriveConfig>): DriveConfig | null {
    return this.store.updateDrive(id, updates);
  }

  /**
   * Deletes a drive configuration by ID.
   * @param id - The unique identifier of the drive to delete.
   * @returns `true` if the drive was found and deleted, `false` otherwise.
   */
  delete(id: string): boolean {
    return this.store.deleteDrive(id);
  }
}
