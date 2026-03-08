import * as store from "./config/store";
import { StorageService } from "./services/StorageService";
import { DriveService } from "./services/DriveService";
import { FileService } from "./services/FileService";
import { AuthController } from "./controllers/AuthController";
import { DriveController } from "./controllers/DriveController";
import { FileController } from "./controllers/FileController";

// --- Services ---
const storageService = new StorageService();
const driveService = new DriveService(store);
const fileService = new FileService(driveService, storageService);

// --- Controllers ---
export const authController = new AuthController(
  process.env.ADMIN_EMAIL!,
  process.env.ADMIN_PASSWORD!,
  process.env.JWT_SECRET!,
);
export const driveController = new DriveController(driveService);
export const fileController = new FileController(fileService);
