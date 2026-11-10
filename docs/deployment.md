# Deployment Guide

Production deployment guidance for the current Smart Library Platform implementation.

This document covers a typical stack:

- **Frontend:** Vercel  
- **Backend:** Render, Railway, Fly.io, or similar  
- **Database:** Neon PostgreSQL  

Adjust host-specific steps for your provider.

---

## Overview

```text
Vercel (React static/Vite)
        ↓ HTTPS
Render / Railway / Fly (FastAPI + Uvicorn)
        ↓ TLS
Neon PostgreSQL
```

---

## Database (Neon)

### 1. Create production database

1. Create a Neon project for production (separate from development).
2. Copy the connection string.
3. Ensure the URL uses SSL:

   ```text
   postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### 2. Run migrations

From your deployment pipeline or locally against the production URL:

```bash
cd backend
export DATABASE_URL="postgresql+psycopg://..."
uv sync
uv run alembic upgrade head
```

**Do not** run autogenerate migrations in production without review.

### 3. Seed strategy

| Environment | Recommendation |
|-------------|----------------|
| Local / staging | Run `SEED_ALLOWED=true uv run python -m app.db.seed` |
| Production | **Do not** run the dev seed script |

For production, create the initial admin account via:

- A one-off secure script, or
- Temporary seed with passwords rotated immediately, or
- Direct database insert with bcrypt hash

The dev seed uses known passwords (`admin123456`, etc.) and must not be used in production.

---

## Backend Deployment

Compatible with any platform that runs a Python web service, or via the
provided Docker image.

### Docker (backend/Dockerfile)

```bash
cd backend
docker build -t smart-library-backend .
docker run -p 8000:8000 \
  -e DATABASE_URL='postgresql+psycopg://...' \
  -e JWT_SECRET_KEY='...' \
  smart-library-backend
```

The image runs Uvicorn as a non-root user and includes a healthcheck on
`/api/v1/health`. Run `alembic upgrade head` as a separate release step
against the same image.

### Build & start (generic)

```bash
cd backend
uv sync --frozen
uv run alembic upgrade head   # in release phase or CI
uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Render example

1. Create a **Web Service** connected to the repository.
2. Root directory: `backend`
3. Build command: `uv sync --frozen`
4. Start command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (see below).
6. Run migrations in a **Release Command**: `uv run alembic upgrade head`

### Railway / Fly.io

Same pattern: install with `uv sync`, migrate on deploy, start Uvicorn on `$PORT`.

---

## Frontend Deployment (Vercel)

1. Import the repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. Build settings (defaults usually work):

   | Setting | Value |
   |---------|-------|
   | Install | `pnpm install` |
   | Build | `pnpm build` |
   | Output | `dist` |

4. Set environment variable:

   ```text
   VITE_API_BASE_URL=https://your-api.example.com/api/v1
   ```

5. Deploy. Vercel serves the Vite production build.

> Environment variables prefixed with `VITE_` are embedded at **build time**. Redeploy after changing the API URL.

---

## Environment Variables

### Backend (required)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://...@neon.tech/db?sslmode=require` |
| `JWT_SECRET_KEY` | Secret for signing JWTs — must be ≥ 32 chars and not a known default; startup fails otherwise | Strong random string (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `CORS_ORIGINS` | JSON array of allowed frontend origins | `["https://app.example.com"]` |

### Backend (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token lifetime |
| `ALLOW_INSECURE_SECRETS` | `false` | Escape hatch permitting weak JWT secrets (local dev/testing only) |
| `LOAN_PERIOD_DAYS` | `14` | Loan duration fallback when no active database circulation policy exists |
| `RESERVATION_EXPIRY_DAYS` | `7` | Reservation expiry fallback when no active database circulation policy exists |
| `DAILY_OVERDUE_FINE_RATE` | `10.00` | Fine rate fallback in INR per calendar day when no active database circulation policy exists |
| `MAX_FINE_AMOUNT` | `500.00` | Per-fine cap fallback when no active database circulation policy exists |
| `MAX_ACTIVE_LOANS` | `5` | Concurrent loan limit fallback when no active database circulation policy exists |
| `LOGIN_RATE_LIMIT_ATTEMPTS` | `5` | Failed logins before lockout |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `300` | Lockout window |
| `EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | FastEmbed model for semantic search |
| `SEMANTIC_SEARCH_ENABLED` | `true` | Master switch for vector queries |
| `DEV_ADMIN_*` | see `.env.example` | Dev seed overrides (local only) |
| `DEV_LIBRARIAN_*` | see `config.py` defaults | Dev seed overrides (local only) |
| `CLOUD_STORAGE_BUCKET` | empty | R2 bucket name; required for digital PDF operations |
| `CLOUD_STORAGE_KEY` | empty | R2 access key ID |
| `CLOUD_STORAGE_SECRET` | empty | R2 secret access key |
| `CLOUD_STORAGE_ENDPOINT` | empty | Account-specific R2 S3 endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com` |

### Frontend (required)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://api.example.com/api/v1` |

---

## Post-Deploy Checklist

- [ ] `DATABASE_URL` set with `sslmode=require` (Neon)
- [ ] `uv run alembic upgrade head` succeeded (current repository head: `024_recommendation_feedback`; use `alembic heads` to verify the checked-out revision)
- [ ] `JWT_SECRET_KEY` is a strong unique value — the server **refuses to start** on known defaults or secrets under 32 characters
- [ ] `CORS_ORIGINS` includes the exact Vercel frontend URL (scheme + host, no trailing slash)
- [ ] `VITE_API_BASE_URL` points to the deployed backend `/api/v1`
- [ ] Frontend redeployed after setting `VITE_API_BASE_URL`
- [ ] Dev seed never run against production (`SEED_ALLOWED=true` is required even to attempt it)
- [ ] `GET /api/v1/health` returns `{ "status": "ok", "database": "connected" }`
- [ ] If semantic search is enabled, embeddings built after deploy: `uv run python -m app.scripts.reindex_embeddings` (downloads the ONNX model on first run)
- [ ] Production admin account created (not dev seed passwords)
- [ ] Dev seed **not** run on production (or passwords rotated immediately)

---

## CORS Configuration

Backend reads `CORS_ORIGINS` as a JSON array:

```text
CORS_ORIGINS=["https://your-app.vercel.app"]
```

For multiple origins (preview + production):

```text
CORS_ORIGINS=["https://your-app.vercel.app","https://preview.vercel.app"]
```

Restart/redeploy the backend after changes.

---

## Health Monitoring

Use for uptime checks and load balancer health probes:

```http
GET /api/v1/health
```

Returns `200` with `status: ok` when the database is reachable; `503` when degraded.

---

## Security Notes

- Never commit `.env` files.
- Rotate `JWT_SECRET_KEY` if compromised (invalidates all tokens).
- Use HTTPS everywhere in production.
- Restrict admin account creation in production.
- Keep Neon credentials in platform secret stores (Render env, Vercel env, etc.).
- Login lockout state is held in process memory. With multiple API workers or replicas, workers do not share lockout counters; restarting a worker clears its counters.

---

## Configuration Notes for Implemented and Future Features

Features may require additional configuration:

| Feature | Additional config |
|---------|-------------------|
| Digital PDFs | Configure all four `CLOUD_STORAGE_*` values for a private Cloudflare R2 bucket |
| Semantic search | Already implemented. PostgreSQL must support pgvector; build embeddings with the reindex command. Keyword search is used if no index is available or semantic inference fails. |

In-app notifications use the application database and need no external service.
See [`architecture.md`](architecture.md) for the current module overview and
remaining planned modules.

---

## Related Documentation

- [`setup.md`](setup.md) — local development
- [`api-spec.md`](api-spec.md) — API reference
- [`../backend/README.md`](../backend/README.md) — backend commands
