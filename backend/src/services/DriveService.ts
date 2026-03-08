import { Inject, Service } from "typedi";
import { v4 as uuid } from "uuid";
import type { DriveConfig } from "../types/drive";
import { DRIVE_STORE } from "../container";

export interface IDriveStore {
  getDrives(): DriveConfig[];
  getDriveById(id: string): DriveConfig | undefined;
  addDrive(drive: DriveConfig): void;
  updateDrive(id: string, updates: Partial<DriveConfig>): DriveConfig | null;
  deleteDrive(id: string): boolean;
}

@Service()
export class DriveService {
  constructor(private store: IDriveStore = DRIVE_STORE) {}

  listAll(): Omit<DriveConfig, "config">[] {
    return this.store.getDrives().map(({ config, ...rest }) => rest);
  }

  getById(id: string): DriveConfig | undefined {
    return this.store.getDriveById(id);
  }

  create(body: { name: string; type: DriveConfig["type"]; isDefault?: boolean; config: any }): DriveConfig {
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

  update(id: string, updates: Partial<DriveConfig>): DriveConfig | null {
    return this.store.updateDrive(id, updates);
  }

  delete(id: string): boolean {
    return this.store.deleteDrive(id);
  }
}
