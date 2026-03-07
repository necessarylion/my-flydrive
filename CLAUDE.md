# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

My Drive - Google Drive-like file management app with multi-provider storage support (local filesystem, S3, GCS, Azure Blob). Monorepo with separate `backend/` and `frontend/` directories.

## Commands

### Backend (Hono + Bun)
```bash
cd backend && bun install        # Install dependencies
cd backend && bun run dev        # Start dev server with hot reload (port 3000)
cd backend && bun run start      # Start production server
cd backend && bun test           # Run tests
```

### Frontend (Vue 3 + Vite)
```bash
cd frontend && bun install       # Install dependencies
cd frontend && bun dev           # Start dev server (port 5173)
cd frontend && bun run build     # Type-check + build for production
cd frontend && bun run type-check  # Type-check only
```

## Architecture

### Backend (`backend/`)
- **Runtime**: Bun (not Node.js). Bun auto-loads `.env` — no dotenv needed.
- **Framework**: Hono (not Express)
- **Storage**: [flydrive](https://github.com/Slynova-Org/flydrive) library abstracts storage providers (local/S3/GCS/Azure)
- **Auth**: JWT-based, single admin user defined in `.env` (ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET)
- **Data persistence**: Drive configs stored as JSON file in `backend/data/drives.json` (git-ignored)
- **File uploads**: Stored in `backend/uploads/` for local drives (git-ignored)
- **API docs**: Swagger UI at `/docs`, OpenAPI spec at `/openapi.json`

Key paths:
- `src/index.ts` — App entry, route mounting, OpenAPI spec
- `src/routes/` — Route handlers (auth, drives CRUD, files operations)
- `src/services/storage.ts` — Creates flydrive Disk instances per drive type
- `src/config/store.ts` — JSON file-based drive config persistence
- `src/types/drive.ts` — TypeScript interfaces for drive configs and file items
- `src/middleware/` — CORS (allows localhost:5173) and JWT auth

API pattern: `/api/auth/*` is public, `/api/drives/*` and `/api/files/*` require JWT.

### Frontend (`frontend/`)
- **Framework**: Vue 3 (Composition API) + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **State**: Pinia stores
- **HTTP**: Axios with auto JWT token injection and 401 redirect
- **Icons**: HugeIcons
- **Path alias**: `@` maps to `frontend/src/`

Key paths:
- `src/api/client.ts` — Axios instance, API functions, shared types (Drive, FileItem)
- `src/router/index.ts` — Vue Router with auth guards
- `src/stores/` — Pinia stores (auth, drives, files)
- `src/views/` — Page components (Login, Drives, Files)
- `src/layouts/MainLayout.vue` — Authenticated layout with sidebar
- `src/components/` — Reusable components (DriveForm, SidebarDriveList, FilePreview)

### Supported Storage Providers
- **local** — Local filesystem (config: `root` path)
- **s3** — AWS S3 / S3-compatible (config: bucket, region, credentials, optional endpoint)
- **gcs** — Google Cloud Storage (config: bucket, projectId, optional keyFilename)
- **azure** — Azure Blob Storage (config: connectionString, container)

## Conventions
- Use `bun` for all package management and script running (not npm/yarn/pnpm)
- Backend uses Bun's native APIs where possible (Bun.file, etc.)
- Folders in storage are created by writing a `.keep` file inside them
- Drive list endpoint strips `config` field from responses (hides credentials)
