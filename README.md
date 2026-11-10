# Smart Library Platform

An AI-powered, cloud-based Library Management System built as a final-year engineering project.

This README describes the **current implementation**. Physical catalog, circulation, reservations, fines, ratings and written reviews, student book recommendations, semantic book search, in-app notifications, QR-based copy labels/scanning, private digital PDFs, admin circulation reports, and audit history for catalog, inventory, reference data, departments, users, circulation, reservations, fines, and policy actions are implemented. Broader analytics remain future work.

**Documentation snapshot:** 2026-11-10. See the sprint reports for dated
delivery history; their old test counts and limitations are not current status.

---

## Project Overview

Smart Library Platform is a web application for managing a library catalog, physical inventory, private digital PDFs, circulation, reservations, fines, and role-based administration. It provides separate experiences for **Admin**, **Librarian**, and **Student** users through a React frontend and a FastAPI backend backed by PostgreSQL.

**Live stack (implemented):**

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Zustand, TanStack Query
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic, JWT authentication
- **Database:** PostgreSQL (local Docker or Neon)

---

## Current Features (Implemented)

| Module | Capabilities |
|--------|--------------|
| **Authentication & RBAC** | JWT login with in-process failed-login lockout, session revocation on password change, role-based route and API protection (Admin, Librarian, Student) |
| **User Management** | Admin CRUD for users, password reset, soft delete, role/department assignment |
| **Department Management** | Admin CRUD for academic departments |
| **Catalog Management** | Books, authors, categories, publishers, languages |
| **Digital Books** | With Cloudflare R2 configured and migration `022_digital_resources` applied, staff can upload, replace, or remove one private PDF per title; authenticated users can open or download it from book details |
| **Inventory / Physical Copies** | Book copies, inventory codes, copy lifecycle (`AVAILABLE`, `BORROWED`, `RESERVED`, `LOST`, `DAMAGED`, `RETIRED`) |
| **Circulation** | Issue, return, student self-service renewals, active/overdue loans (UTC calendar), student loan history, per-student loan limit, server-side staff loan search and pagination; staff can scan a copy QR code to filter/select it |
| **QR Copy Labels** | Staff can print a QR label per copy or print all labels for a book; the QR encodes the existing inventory code |
| **Reservations** | FIFO reservation queue enforced at issue and return time; expired reservations are processed before circulation queue decisions; creation, cancellation, expiry, and fulfillment are included in the admin audit log |
| **Fines** | Overdue balances accrue on open loans (calendar days, capped), finalize on return, block new borrowing while unpaid, and can be marked paid exactly once after return |
| **Circulation Policy** | Dynamic DB-backed policy management (fine rate, max fine cap, loan period, max active loans, renewal limit, hold expiry), latest editor attribution, and Admin UI |
| **Dashboards** | Role-specific home dashboards with KPIs and recent activity |
| **Analytics & Reports** | Admin-only date-filtered circulation and reservation totals/trends, return performance, overdue aging, unpaid fine balance, reservation wait, popular books/categories, department participation, current inventory pressure/utilization, and CSV export |
| **Audit Log** | Admin-only, read-only history for catalog, digital PDF, inventory, reference-data, department, and user changes; book issue/return/renewal; reservation creation/cancellation/expiry/fulfillment; fine recording/payment; and circulation policy changes |
| **In-app Notifications** | User-scoped confirmations for book issues/returns and fine payments, plus alerts for reservation-ready copies, due-soon or overdue loans, and recorded fines |
| **Ratings & Reviews** | Students rate each book once (1–5) and can add, edit, or remove an optional written review; authenticated users can see the average and recent reviews on book detail pages |
| **Recommendations** | Student dashboard ranks available, unseen titles using existing semantic embeddings, positive ratings, borrowing history, category interests, and library popularity, with diversity and non-semantic fallbacks |
| **Semantic Search** | `GET /books/search` natural-language ranking via FastEmbed (`BAAI/bge-small-en-v1.5`) + pgvector; book creates/edits and searchable author/category/publisher renames or soft deletions queue affected books for background reindexing, with admin status/retry/full rebuild and an offline reindex command |

For API details see [`docs/api-spec.md`](docs/api-spec.md). For schema details see [`docs/database.md`](docs/database.md).

---

## Planned Features (Future Work)

The following remain **design targets not implemented** in the current codebase:

| Area | Status |
|------|--------|
| Broader analytics dashboards and trends beyond circulation reports | Future |
| Library calendar / working-day fines | Future |
| Token refresh / server-side logout | Server-side revocation on password reset/change is live (`users.token_version`); refresh endpoint is Future |

---

## Getting Started

Full setup and troubleshooting: [`docs/setup.md`](docs/setup.md)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for local PostgreSQL)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (frontend package manager)
- Node.js 22+ recommended (the frontend CI workflow uses Node 22)

### Option A — Local Docker PostgreSQL

From the repository root:

```bash
docker compose up -d

cd backend
cp .env.example .env
# Edit backend/.env and replace the JWT_SECRET_KEY placeholder with a random value of 32+ characters.
uv sync
uv run alembic upgrade head
SEED_ALLOWED=true uv run python -m app.db.seed
uv run uvicorn app.main:app --reload --port 8000

cd ../frontend
cp .env.example .env
pnpm install
pnpm dev
```

- **API:** http://localhost:8000/api/v1  
- **Frontend:** http://localhost:5173  
- **Health check:** http://localhost:8000/api/v1/health  

### Option B — Neon PostgreSQL

1. Create a project in [Neon](https://neon.tech).
2. Copy the connection string (use the **pooled** or **direct** URL as appropriate).
3. Create `backend/.env` from `backend/.env.example`, then set `DATABASE_URL`
   and replace `JWT_SECRET_KEY` with a unique value at least 32 characters long:

   ```text
   DATABASE_URL=postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

4. From `backend/`:

   ```bash
   uv sync
   uv run alembic upgrade head
   SEED_ALLOWED=true uv run python -m app.db.seed    # local/dev only — see docs/setup.md
   uv run uvicorn app.main:app --reload --port 8000
   ```

5. Configure and start the frontend as in Option A.

See [`docs/setup.md`](docs/setup.md) for Neon SSL notes, CORS, and troubleshooting.

---

## Development Credentials

Created by `SEED_ALLOWED=true uv run python -m app.db.seed` (local development only):

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@library.local` | `admin123456` | Full admin + staff access |
| Librarian | `librarian@library.local` | `librarian123456` | Circulation + catalog staff access |
| Student | `student@library.local` | `student123456` | Student code: `STU-001` |
| Student 2 | `student2@library.local` | `student123456` | Student code: `STU-002` |

The login page shows dev account emails (no passwords) when running the frontend in Vite dev mode.

---

## Project Structure

```text
smart-library-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST routers
│   │   ├── core/               # Config, DB, security, logging
│   │   ├── db/seed.py          # Development seed script
│   │   ├── models/             # SQLAlchemy models
│   │   ├── repositories/       # Data access
│   │   ├── schemas/            # Pydantic API contracts
│   │   └── services/           # Business logic
│   ├── alembic/                # Database migrations
│   ├── tests/
│   └── README.md
├── frontend/
│   └── src/
│       ├── pages/              # login, dashboard, catalog, circulation, admin
│       ├── layouts/            # MainLayout, CatalogLayout, etc.
│       ├── services/           # API clients
│       ├── routes/             # React Router config
│       └── store/              # Zustand auth store
├── docs/
│   ├── api-spec.md
│   ├── architecture.md
│   ├── database.md
│   ├── setup.md
│   ├── deployment.md
│   └── sprint-4-summary.md
├── .github/workflows/          # CI: backend (migrations + Ruff + pytest), frontend (ESLint + tests + build)
├── docker-compose.yml          # Local PostgreSQL (pgvector image)
└── README.md
```

---

## Architecture Summary

```text
React Frontend (Vite)
        ↓  HTTPS / REST + JWT
FastAPI Backend (layered: API → Service → Repository → DB)
        ↓
PostgreSQL (Docker local or Neon)
```

**RBAC:** Three roles — `ADMIN`, `LIBRARIAN`, `STUDENT`. Backend enforces role checks on every protected endpoint; the frontend uses route guards (`AdminRoute`, `StaffRoute`, `ProtectedRoute`) for UX only.

See [`docs/architecture.md`](docs/architecture.md) for module-level detail.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/setup.md`](docs/setup.md) | Local and Neon development setup |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment guidance |
| [`docs/api-spec.md`](docs/api-spec.md) | Implemented REST API reference |
| [`docs/database.md`](docs/database.md) | Implemented and planned schema |
| [`docs/architecture.md`](docs/architecture.md) | System architecture |
| [`docs/project-rules.md`](docs/project-rules.md) | Engineering standards |
| [`docs/sprint-4-summary.md`](docs/sprint-4-summary.md) | Sprint 4 delivery history |
| [`docs/sprint-4-acceptance-tests.md`](docs/sprint-4-acceptance-tests.md) | Circulation acceptance criteria and historical test record |
| [`docs/sprint-4.1-completion-report.md`](docs/sprint-4.1-completion-report.md) | Historical hardening report with current follow-up status |
| [`docs/sprint-4.2-completion-report.md`](docs/sprint-4.2-completion-report.md) | Historical inventory and UX report |
| [`docs/sprint-4.9-completion-report.md`](docs/sprint-4.9-completion-report.md) | Historical UI polish report |

---

## Screenshots

> Placeholder sections — add images under `docs/screenshots/` when available.

### Login

Branded two-column login with dev account helper (development mode only).

### Student Dashboard

Welcome header, loan/reservation/fine KPIs, recent activity, quick actions.

### Librarian Dashboard

Circulation metrics and recent transactions.

### Admin Dashboard

User/catalog metrics and recent platform activity.

### User Management

Admin user list and create/edit forms.

### Catalog

Book list, detail, and staff catalog management.

### Circulation

Issue/return workflows with reservation queue awareness.

---

## Development Commands

```bash
# Backend tests
cd backend && uv run pytest

# Frontend production build
cd frontend && pnpm build
```

---

## Technology Stack

### Implemented & in use

| Layer | Technologies |
|-------|--------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Zustand, TanStack Query, Axios |
| Backend | Python 3.12+, FastAPI, Uvicorn, SQLAlchemy, Alembic, Psycopg, Pydantic, PyJWT, bcrypt, FastEmbed |
| Database | PostgreSQL 16 (Docker Compose or Neon) with pgvector |
| Tooling | uv, pnpm, Git |

### Planned (not yet integrated)

- Broader analytics charting beyond the existing circulation and operational dashboards

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for Render/Railway/Fly backend, Vercel frontend, Neon database, environment variables, and post-deploy checklist.

Target production stack:

- **Frontend:** Vercel  
- **Backend:** Render (or compatible PaaS)  
- **Database:** Neon PostgreSQL  

---

## License

Educational project.
