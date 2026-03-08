# My Drive

A self-hosted lightweight Google Drive-like file management application with multi-provider storage support.

## Features

- **Multi-provider storage** — Local filesystem, AWS S3, Google Cloud Storage, Azure Blob Storage
- **File explorer** — Browse, upload, download, delete files and create folders
- **File preview** — Image, PDF, audio, video, and text file preview (up to 200MB)
- **Drive management** — Configure and switch between multiple storage backends

## Tech Stack

**Backend:** Bun, Hono, FlyDrive, Swagger UI

**Frontend:** Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS, HugeIcons

## Getting Started

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

## License

MIT
