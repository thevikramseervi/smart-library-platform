# Deployment Guide

Production deployment guidance for the Smart Library Platform as of Sprint 4.7.

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
| Local / staging | Run `uv run python -m app.db.seed` |
| Production | **Do not** run the dev seed script |

For production, create the initial admin account via:

- A one-off secure script, or
- Temporary seed with passwords rotated immediately, or
- Direct database insert with bcrypt hash

The dev seed uses known passwords (`admin123456`, etc.) and must not be used in production.

---

## Backend Deployment

Compatible with any platform that runs a Python web service.

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
| `JWT_SECRET_KEY` | Secret for signing JWTs | Strong random string |
| `CORS_ORIGINS` | JSON array of allowed frontend origins | `["https://app.example.com"]` |

### Backend (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token lifetime |
| `LOAN_PERIOD_DAYS` | `14` | Loan duration |
| `RESERVATION_EXPIRY_DAYS` | `7` | Reservation expiry |
| `DAILY_OVERDUE_FINE_RATE` | `10.00` | INR per calendar day overdue |
| `DEV_ADMIN_*` | see `.env.example` | Dev seed overrides (local only) |
| `DEV_LIBRARIAN_*` | see `config.py` defaults | Dev seed overrides (local only) |
| `CLOUD_STORAGE_*` | empty | Reserved for future digital resources (Sprint 5+) |

### Frontend (required)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://api.example.com/api/v1` |

---

## Post-Deploy Checklist

- [ ] `DATABASE_URL` set with `sslmode=require` (Neon)
- [ ] `uv run alembic upgrade head` succeeded
- [ ] `JWT_SECRET_KEY` is a strong unique value (not the example default)
- [ ] `CORS_ORIGINS` includes the exact Vercel frontend URL (scheme + host, no trailing slash)
- [ ] `VITE_API_BASE_URL` points to the deployed backend `/api/v1`
- [ ] Frontend redeployed after setting `VITE_API_BASE_URL`
- [ ] `GET /api/v1/health` returns `{ "status": "ok", "database": "connected" }`
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

---

## Future Deployment Considerations (Not Yet Implemented)

When Sprint 5+ features ship, additional configuration will be required:

| Feature | Additional config |
|---------|-------------------|
| Digital resources | Cloudflare R2 (`CLOUD_STORAGE_*`) |
| AI / semantic search | pgvector extension on Neon, model serving |
| Notifications | Email/push provider credentials |

See [`architecture.md`](architecture.md) for planned modules.

---

## Related Documentation

- [`setup.md`](setup.md) — local development
- [`api-spec.md`](api-spec.md) — API reference
- [`../backend/README.md`](../backend/README.md) — backend commands
