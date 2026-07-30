# Deployment Guide

This document outlines the official deployment strategies for ReForge. The system is designed to be highly modular, supporting both managed cloud deployments (Vercel + Render) and self-hosted containerized deployments (Docker Compose).

---

## 1. Deployment Overview

ReForge consists of a Next.js frontend and a FastAPI backend. Because the architecture relies on local file storage for SQLite and ChromaDB in its default configuration, the backend must be deployed in an environment that supports persistent storage volumes (e.g., Render, Docker volumes) or be reconfigured to use external databases (e.g., PostgreSQL).

## 2. Deployment Architecture

- **Frontend:** Next.js deployed on Vercel or as a standalone Docker container.
- **Backend:** FastAPI deployed on Render (Web Service) or as a Docker container.
- **Storage:** SQLite for relational data and ChromaDB for vector data. Both write to a local `storage/` directory, requiring a persistent disk.

---

## 3. Frontend Deployment (Vercel)

The Next.js frontend is fully optimized for Vercel deployment.

1. Connect your repository to Vercel.
2. Set the framework preset to **Next.js**.
3. **Important:** Vercel has a strict 4.5MB request payload limit. ReForge circumvents this by uploading documents directly from the browser to the backend. To ensure this works, you must update the `connect-src` Content Security Policy (CSP) in `next.config.ts` to explicitly allow your backend URL.

---

## 4. Backend Deployment (Render)

The FastAPI backend requires system-level dependencies for PDF/OCR processing and a persistent disk for database storage.

1. Create a new **Web Service** on Render.
2. Select **Docker** as the environment (Render will automatically detect and build from `backend/Dockerfile`).
3. Under **Advanced**, add a **Disk**:
   - **Name:** `reforge-storage`
   - **Mount Path:** `/app/storage`
4. Set the `CHROMA_MODE` environment variable to `persistent`.

---

## 5. Docker & Docker Compose Deployment

For self-hosting, ReForge includes a production-ready `docker-compose.yml` that orchestrates four containers: `frontend`, `api`, `chroma`, and `db` (PostgreSQL).

To deploy:
```bash
docker-compose up --build -d
```

**Note on Dockerfiles:**
- The `frontend/Dockerfile` utilizes Next.js `standalone` output mode to drastically reduce the container image size.
- The `backend/Dockerfile` installs `tesseract-ocr` and `poppler-utils` natively and pre-downloads the ChromaDB ONNX embedding model during the build phase to prevent runtime delays.

---

## 6. Required Environment Variables

### Frontend (`frontend/.env.local`)
- `NEXTAUTH_URL`: The public URL of your frontend (e.g., `https://your-app.vercel.app`).
- `NEXTAUTH_SECRET`: A secure random string for JWT encryption.
- `BACKEND_URL`: The URL of your FastAPI backend (used for API proxy rewrites).

### Backend (`backend/.env`)
- `JWT_SECRET`: Must match the frontend's `NEXTAUTH_SECRET` if sharing token verification, or be unique for backend-specific JWTs depending on auth architecture.
- `GEMINI_API_KEY`: Required for LLM inference and embedding generation.
- `DATABASE_URL`: Connection string. Use `sqlite+aiosqlite:///storage/reforge.db` for SQLite or a Postgres URL if using Docker Compose.
- `CHROMA_MODE`: Set to `persistent` for Render or `http` if using the dedicated Chroma container in Docker Compose.

---

## 7. Persistent Storage Configuration

If you are not using an external database like PostgreSQL, your backend container **must** have a persistent volume mounted to `/app/storage`. 

Failure to do so will result in all users, chat histories, and vector embeddings being permanently deleted every time the container restarts or redeploys.

---

## 8. Production Considerations

- **CORS:** Ensure the FastAPI `CORSMiddleware` in `backend/app/main.py` is configured to allow requests exclusively from your frontend domain.
- **API Limits:** Because ReForge can trigger multiple LLM calls per query (via LangGraph self-critique), you must monitor your Gemini API quotas closely in production.

---

## 9. Troubleshooting

**Uploads fail with 413 Payload Too Large:**
Your frontend is attempting to proxy the file through Vercel. Ensure `NEXT_PUBLIC_BACKEND_URL` is correctly exposed to the browser so the upload goes directly to the backend.

**Uploads blocked by CSP:**
Update `next.config.ts` to include your production backend domain in the `connect-src` header.

**Database Locked Errors:**
SQLite can struggle with high concurrent writes. If experiencing lock errors, migrate to PostgreSQL by updating the `DATABASE_URL`.
