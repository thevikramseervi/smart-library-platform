# Setup Guide

Complete local development setup for the Smart Library Platform.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| Docker | Local PostgreSQL (`docker compose`) |
| uv | Python dependencies and commands |
| pnpm | Frontend dependencies |
| Node.js 20+ | Frontend dev server |

Optional: a [Neon](https://neon.tech) account for cloud PostgreSQL instead of Docker.

---

## Local Development (Docker PostgreSQL)

### 1. Clone and start database

```bash
git clone <repository-url>
cd smart-library-platform
docker compose up -d
```

Wait for PostgreSQL to be healthy:

```bash
docker compose ps
```

The compose file (`docker-compose.yml`) runs `pgvector/pgvector:pg16` on port **5432** with:

- User: `smart_library`
- Password: `smart_library`
- Database: `smart_library`

> **Note:** The current application migrations only require standard PostgreSQL + `pgcrypto`. The pgvector image is used for future AI features.

### 2. Backend setup

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

### 4. Verify

| Check | URL |
|-------|-----|
| API health | http://localhost:8000/api/v1/health |
| OpenAPI | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |
| Login | Use credentials from [Development credentials](#development-credentials) |

---

## Neon Workflow

Use Neon when you prefer cloud PostgreSQL over local Docker.

### 1. Create a Neon project

1. Sign in at [neon.tech](https://neon.tech).
2. Create a new project and database.
3. Copy the connection string from the Neon dashboard.

### 2. Configure backend

```bash
cd backend
cp .env.example .env
```

Set `DATABASE_URL` in `.env`:

```text
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>/<dbname>?sslmode=require
```

**Important:**

- Use the `postgresql+psycopg://` driver prefix (required by SQLAlchemy in this project).
- Include `sslmode=require` for Neon SSL connections.
- Do not commit `.env` to version control.

You do **not** need `docker compose` when using Neon.

### 3. Migrate and seed

```bash
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
```

> **Production warning:** The seed script creates default admin/librarian/student accounts with known passwords. Run seed only in local/staging environments, or create production admin accounts manually.

### 4. Start services

```bash
uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd ../frontend && pnpm dev
```

---

## Migrations

Always run from `backend/`:

```bash
uv run alembic upgrade head
```

Alembic reads `DATABASE_URL` from `backend/.env` via `app.core.config.settings`.

If migrations fail on a fresh Neon database, verify:

- Connection string is correct and includes `sslmode=require`
- Database user has permission to create extensions (`pgcrypto` is created in migration `001`)

---

## Seeding

```bash
cd backend
uv run python -m app.db.seed
```

Creates:

- Roles: `ADMIN`, `LIBRARIAN`, `STUDENT`
- Sample departments and languages
- Development users (see below)

The script is safe to re-run; it skips existing records.

---

## Development Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@library.local` | `admin123456` |
| Librarian | `librarian@library.local` | `librarian123456` |
| Student | `student@library.local` | `student123456` |
| Student 2 | `student2@library.local` | `student123456` |

Without seeding, login will fail because no users exist.

---

## Running Backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Environment variables are loaded from `backend/.env`.

---

## Running Frontend

```bash
cd frontend
pnpm dev
```

Default dev server: http://localhost:5173

Frontend API URL is set in `frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Troubleshooting

### CORS errors

**Symptom:** Browser console shows blocked requests; login fails with network error.

**Fix:**

1. Ensure backend is running on port 8000.
2. Ensure frontend runs on port **5173** (matches default `CORS_ORIGINS`).
3. If using a different frontend port, update `CORS_ORIGINS` in `backend/.env`:

   ```text
   CORS_ORIGINS=["http://localhost:5174"]
   ```

4. Restart the backend after changing `.env`.

### Alembic issues

**Symptom:** `alembic upgrade head` fails with connection errors.

**Fix:**

- Verify `DATABASE_URL` in `backend/.env`
- For Docker: `docker compose ps` — ensure db is healthy
- For Neon: verify SSL (`sslmode=require`) and credentials

**Symptom:** `Target database is not up to date`

**Fix:** Run `uv run alembic upgrade head` from `backend/`

### Missing seed data / login fails

**Symptom:** `401` on login or "Invalid credentials" for dev emails.

**Fix:**

```bash
cd backend
uv run python -m app.db.seed
```

Confirm users exist (optional):

```bash
uv run python -c "from app.db.seed import run_seed; run_seed()"
```

### Neon SSL configuration

**Symptom:** SSL connection errors to Neon.

**Fix:** Append `?sslmode=require` to the connection string (or `&sslmode=require` if other query params exist).

Example:

```text
postgresql+psycopg://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### Port conflicts

**Symptom:** `Address already in use` on 5432, 5173, or 8000.

**Fix:**

```bash
# Find process on a port (example: 8000)
lsof -i :8000
```

- Stop conflicting services, or
- Change ports (update `DATABASE_URL`, uvicorn `--port`, and `CORS_ORIGINS` / `VITE_API_BASE_URL` accordingly)

### Frontend build vs dev

`pnpm dev` uses Vite dev server. For production build verification:

```bash
cd frontend && pnpm build
```

---

## Next Steps

- API reference: [`api-spec.md`](api-spec.md)
- Deployment: [`deployment.md`](deployment.md)
- Backend details: [`../backend/README.md`](../backend/README.md)
