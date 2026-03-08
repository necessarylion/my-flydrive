import { Hono } from 'hono';
import { AuthController } from '../controllers/AuthController';
import { Controller } from '../utils/controller';

export const authPublicRoutes = new Hono();
authPublicRoutes.post('/login', Controller(AuthController, 'login'));

export const authProtectedRoutes = new Hono();
authProtectedRoutes.get('/me', Controller(AuthController, 'me'));
