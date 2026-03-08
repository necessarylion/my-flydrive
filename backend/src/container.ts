import 'reflect-metadata';
import * as store from './config/store';

/** Drive configuration store providing CRUD operations for persisted drive configs. */
export const DRIVE_STORE = store;

/** Admin user email address, loaded from the {@link process.env.ADMIN_EMAIL} environment variable. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

/** Admin user password, loaded from the {@link process.env.ADMIN_PASSWORD} environment variable. */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

/** Secret key used to sign and verify JWT tokens, loaded from the {@link process.env.JWT_SECRET} environment variable. */
export const JWT_SECRET = process.env.JWT_SECRET!;
