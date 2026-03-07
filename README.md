# My Drive

A self-hosted Google Drive-like file management application with multi-provider storage support.

## Features

- **Multi-provider storage** — Local filesystem, AWS S3, Google Cloud Storage, Azure Blob Storage
- **File explorer** — Browse, upload, download, delete files and create folders
- **File preview** — Image, PDF, audio, video, and text file preview (up to 200MB)
- **Drive management** — Configure and switch between multiple storage backends
- **JWT authentication** — Secured API with email/password login

## Tech Stack

**Backend:** Bun, Hono, FlyDrive, Swagger UI

**Frontend:** Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS, HugeIcons

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed

### Backend

```bash
cd backend
bun install
```

Create a `.env` file:

```env
ADMIN_EMAIL=admin@mydrive.com
ADMIN_PASSWORD=your-password
JWT_SECRET=change-this-to-a-random-secret-key
```

Start the server:

```bash
bun run dev
```

The API runs at `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/docs`.

### Frontend

```bash
cd frontend
bun install
bun run dev
```

The app runs at `http://localhost:5173`.

### Docker

Run with Docker Compose:

```bash
docker compose up -d
```

Or build and run manually:

```bash
docker build -t my-drive .
docker run -p 3000:3000 \
  -e ADMIN_EMAIL=admin@drive.com \
  -e ADMIN_PASSWORD=your-password \
  -e JWT_SECRET=change-this-to-a-random-secret-key \
  -v my-drive-data:/app/data \
  -v my-drive-uploads:/app/uploads \
  my-drive
```

The app runs at `http://localhost:3000`.

Pre-built images are available from GitHub Container Registry:

```bash
docker pull ghcr.io/necessarylion/my-flydrive:main
```

## Supported Storage Providers

| Provider | Config |
| --- | --- |
| **Local** | `root` — absolute path to storage directory |
| **AWS S3** | `bucket`, `region`, `accessKeyId`, `secretAccessKey`, optional `endpoint` |
| **Google Cloud Storage** | `bucket`, optional `keyFilename` |
| **Azure Blob Storage** | `connectionString`, `container` |

## API Endpoints

### Auth
- `POST /api/auth/login` — Login with email/password
- `GET /api/auth/me` — Get current user (requires auth)

### Drives
- `GET /api/drives` — List all drives
- `GET /api/drives/:id` — Get drive details
- `POST /api/drives` — Create a drive
- `PUT /api/drives/:id` — Update a drive
- `DELETE /api/drives/:id` — Delete a drive

### Files
- `GET /api/files/:driveId/list?path=` — List files
- `POST /api/files/:driveId/upload?path=` — Upload a file
- `GET /api/files/:driveId/download?path=` — Download a file
- `GET /api/files/:driveId/preview?path=` — Preview a file
- `DELETE /api/files/:driveId?path=` — Delete a file
- `POST /api/files/:driveId/folder` — Create a folder

## License

MIT
