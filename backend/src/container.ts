import "reflect-metadata";
import * as store from "./config/store";

export const DRIVE_STORE = store;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
export const JWT_SECRET = process.env.JWT_SECRET!;
