import { jwt } from 'hono/jwt';

/**
 * Hono JWT middleware instance configured with the application's secret.
 * Validates the Bearer token in the Authorization header using HS256 algorithm.
 * Apply to routes that require authenticated access.
 */
export const jwtMiddleware = jwt({
  secret: process.env.JWT_SECRET!,
  alg: 'HS256',
});
