# Stage 1: Build frontend
FROM oven/bun:1 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build-only

# Stage 2: Install backend dependencies
FROM oven/bun:1 AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/bun.lock ./
COPY backend/patches ./patches
RUN bun install --frozen-lockfile --production

# Stage 3: Final image
FROM oven/bun:1-slim
WORKDIR /app

COPY backend/package.json backend/bun.lock ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Copy built frontend into backend's public directory
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 3000

CMD ["bun", "run", "start"]
