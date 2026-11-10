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
JWT_SECRET_KEY=<strong random value, ≥ 32 chars — see .env.example for a generation command>
```

The server refuses to start with the documented example secret; set `ALLOW_INSECURE_SECRETS=true` only for throwaway local runs.

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
| `005_enable_pgvector` | Enables PostgreSQL `vector` extension |
| `006_search_schema` | Book embeddings and semantic search indexes |
| `007_missing_fk_indexes` | Indexes on foreign keys for query performance |
| `008_transaction_reservation_link` | Links transactions to fulfilled reservations |
| `009_user_token_version` | Server-side session revocation via `token_version` |
| `010_transaction_returned_by` | Tracks staff member processing returns |
| `011_embedding_384_dims` | Updates embedding dimensions to 384 for bge-small-en-v1.5 |
| `012_ratings` | Book ratings 1-5 with unique constraint per student |
| `013_circulation_policies` | Dynamic database-backed circulation policies |
| `014_model_index_alignment` | Adds model-declared copy-status and rating indexes; removes the redundant fine unique index |
| `015_book_renewals` | Tracks renewal counts and adds the configurable maximum renewals to circulation policy |
| `016_in_app_notifications` | Adds persistent user-scoped notifications for circulation events |
| `017_book_issued_type` | Allows book-issue confirmation notifications |
| `018_loan_overdue_type` | Allows one-time overdue loan notifications |
| `019_return_and_fine_paid_types` | Allows book-return and fine-payment notifications |
| `020_audit_logs` | Adds admin-visible audit records for catalog and digital-resource, reference data, department, user, circulation, reservation, fine, and policy changes |
| `021_rating_reviews` | Adds optional student-written review text to book ratings |
| `022_digital_resources` | Adds metadata for one private Cloudflare R2 PDF per catalog book |
| `023_student_admission_year` | Replaces the users' `semester` column with optional `admission_year`; existing semester values are not converted |
| `024_recommendation_feedback` | Adds per-student, per-book `LIKE` and `DISMISS` feedback for recommendations |

---

## Seed Process

Populates roles, departments, languages, and development users. **Intended for local development and testing only.**

```bash
SEED_ALLOWED=true uv run python -m app.db.seed
```

To seed users and reference data, run the first command. To also import the
curated Open Library catalog, use `--catalog` instead. **The catalog import
clears existing books, authors, publishers, categories, and circulation rows**;
use it only on a disposable development database.

```bash
SEED_ALLOWED=true uv run python -m app.db.seed --catalog
```

Catalog import reads `app/db/data/catalog_manifest.json` and Open Library
metadata. `uv run python -m app.scripts.import_real_books` is a separate wrapper
around the same importer; it also clears catalog/circulation rows and uses
network metadata lookups by default. Do not run either catalog import against
data you need to preserve.

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

Tests use FastAPI's `TestClient` against the application and require PostgreSQL
with the migrations applied. Use a dedicated test database; never point test
runs at a database whose data must be preserved.

**Test isolation:** Pytest uses `TEST_DATABASE_URL` when set, otherwise `DATABASE_URL`. Each test runs inside a rolled-back SQLAlchemy transaction (`join_transaction_mode="create_savepoint"`) so API commits never persist. Override `get_db` routes all requests through the test session.

Recommended local setup — Compose includes an isolated test database on port 5433:

```bash
docker compose up -d testdb          # pgvector Postgres on 127.0.0.1:5433
DATABASE_URL='postgresql+psycopg://smart_library:smart_library@127.0.0.1:5433/smart_library_test' \
  uv run alembic upgrade head
# Add to backend/.env:
# TEST_DATABASE_URL=postgresql+psycopg://smart_library:smart_library@127.0.0.1:5433/smart_library_test
```

Reference data (roles, dev users, languages) is seeded automatically inside each test's transaction; never run the seed script against the test database.

Without `TEST_DATABASE_URL`, tests use `DATABASE_URL`. The test fixtures wrap
each test in an outer transaction and roll it back, but a dedicated test
database is still recommended to avoid accidental impact if fixture behavior
changes.

CI is configured in `.github/workflows/backend.yml`: it starts pgvector/Postgres,
installs locked dependencies, runs Ruff, applies migrations, then runs pytest.

---

## Common Commands

| Task | Command |
|------|---------|
| Install deps | `uv sync` |
| Run server | `uv run uvicorn app.main:app --reload` |
| Migrate | `uv run alembic upgrade head` |
| Seed dev data | `SEED_ALLOWED=true uv run python -m app.db.seed` |
| Import catalog | `uv run python -m app.db.import_catalog` |
| Reindex embeddings | `uv run python -m app.scripts.reindex_embeddings` |
| Test | `uv run pytest` |
| Lint | `uv run ruff check .` |

---

## Project Layout

```text
backend/
├── app/
│   ├── api/v1/endpoints/   # Route handlers (no business logic)
│   ├── core/               # config.py, database.py, security.py, rate_limit.py, clock.py
│   ├── db/seed.py          # Development seed (SEED_ALLOWED=true required)
│   ├── scripts/            # reindex_embeddings and similar CLIs
│   ├── search/             # Embedding provider + document builder
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
