import './container'; // must be first - registers DI tokens
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { bodyLimit } from 'hono/body-limit';
import { jwtMiddleware } from './middleware/auth';
import { securityHeaders } from './middleware/security';
import { loginRateLimiter } from './middleware/rateLimiter';
import {
  publicRoutes as authPublicRoutes,
  protectedRoutes as authProtectedRoutes,
} from './routes/auth';
import api from './routes/api';

const app = new Hono();

// Security headers on all responses
app.use('*', securityHeaders);

// Public routes
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/api/auth', authPublicRoutes);

// middlewares
app.use('/api/files/*/upload', bodyLimit({ maxSize: 10 * 1024 * 1024 * 1024 })); // 10GB
app.use('/api/auth/login', loginRateLimiter);

// All /api/* routes require JWT
app.use('/api/*', jwtMiddleware);

// Protected routes
app.route('/api/auth', authProtectedRoutes);
app.route('/api', api);

// Serve frontend static files in production
app.use('/*', serveStatic({ root: './public' }));
app.get('/*', serveStatic({ root: './public', path: 'index.html' }));

/**
 * Bun server configuration exported as the default module.
 *
 * @property {number} port - The port the server listens on (3000).
 * @property {Function} fetch - The Hono app fetch handler for incoming requests.
 * @property {number} maxRequestBodySize - Maximum allowed request body size (10 GB).
 */
export default {
  port: 3000,
  fetch: app.fetch,
  maxRequestBodySize: 10 * 1024 * 1024 * 1024, // 10GB
};
