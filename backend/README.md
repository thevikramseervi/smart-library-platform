# Smart Library Platform — Backend

FastAPI REST API for the Smart Library Platform.

---

## Requirements

- **Python** 3.12+
- **[uv](https://docs.astral.sh/uv/)** — dependency and virtual environment management
- **PostgreSQL** 16+ — local Docker (`docker compose up -d` from repo root) or [Neon](https://neon.tech)

---

## Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your `DATABASE_URL` and secrets. See [`../docs/deployment.md`](../docs/deployment.md) for the full variable list.

Minimum required variables:

```text
DATABASE_URL=postgresql+psycopg://smart_library:smart_library@localhost:5432/smart_library
JWT_SECRET_KEY=change-me-in-production
```

Install dependencies:

```bash
uv sync
```

---

## Database Setup

### Local Docker (from repository root)

```bash
docker compose up -d
```

Uses credentials matching `backend/.env.example` default `DATABASE_URL`.

### Neon

Set `DATABASE_URL` with `sslmode=require`:

```text
postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

---

## Alembic Migrations

Run from the `backend/` directory:

```bash
uv run alembic upgrade head
```

Other useful commands:

```bash
# Show current revision
uv run alembic current

# Show migration history
uv run alembic history

# Create a new migration (development)
uv run alembic revision --autogenerate -m "description"
```

Migration files live in `alembic/versions/`:

| Revision | Description |
|----------|-------------|
| `001_core_schema` | Roles, departments, users |
| `002_catalog_schema` | Catalog tables and book copies |
| `003_circulation_schema` | Transactions, reservations, fines |
| `004_book_copy_retired_status` | Adds `RETIRED` copy status |

---

## Seed Process

Populates roles, departments, languages, and development users. **Intended for local development and testing only.**

```bash
uv run python -m app.db.seed
```

Seed users and roles, then optionally import the real Open Library catalog:

```bash
uv run python -m app.db.seed --catalog
uv run python -m app.db.import_catalog
uv run python -m app.scripts.import_real_books
```

Catalog import clears books, authors, publishers, categories, and circulation rows, then loads ~190 curated CS/tech titles from `app/db/data/catalog_manifest.json` using cached Open Library metadata.

Seed is idempotent — existing records are skipped.

Default credentials are documented in the root [`README.md`](../README.md#development-credentials).

---

## Run Backend

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- API base: http://localhost:8000/api/v1  
- OpenAPI docs: http://localhost:8000/docs  
- Health: http://localhost:8000/api/v1/health  

Ensure `CORS_ORIGINS` in `.env` includes your frontend origin (default `http://localhost:5173`).

---

## Run Tests

```bash
uv run pytest
```

Quiet output:

```bash
uv run pytest -q
```

Tests use FastAPI's `TestClient` against the application with the configured database. Use a dedicated test database in CI/production pipelines.

---

## Common Commands

| Task | Command |
|------|---------|
| Install deps | `uv sync` |
| Run server | `uv run uvicorn app.main:app --reload` |
| Migrate | `uv run alembic upgrade head` |
| Seed dev data | `uv run python -m app.db.seed` |
| Import catalog | `uv run python -m app.db.import_catalog` |
| Test | `uv run pytest` |
| Lint | `uv run ruff check .` |

---

## Project Layout

```text
backend/
├── app/
│   ├── api/v1/endpoints/   # Route handlers (no business logic)
│   ├── core/               # config.py, database.py, security.py
│   ├── db/seed.py          # Development seed
│   ├── models/             # SQLAlchemy ORM models
│   ├── repositories/       # Database queries
│   ├── schemas/            # Pydantic request/response models
│   ├── services/           # Business logic
│   └── main.py             # FastAPI app entry
├── alembic/
├── tests/
├── .env.example
└── pyproject.toml
```

Architecture rules: API → Service → Repository → Database. See [`../docs/project-rules.md`](../docs/project-rules.md).

---

## Further Reading

- [`../docs/setup.md`](../docs/setup.md) — full development setup and troubleshooting
- [`../docs/api-spec.md`](../docs/api-spec.md) — REST API reference
- [`../docs/database.md`](../docs/database.md) — schema documentation
