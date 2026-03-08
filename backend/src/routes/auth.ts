import { Hono } from 'hono';
import { AuthController } from '../controllers/AuthController';
import { Controller } from '../utils/controller';

export const publicRoutes = new Hono();
publicRoutes.post('/login', Controller(AuthController, 'login'));

export const protectedRoutes = new Hono();
protectedRoutes.get('/me', Controller(AuthController, 'me'));
