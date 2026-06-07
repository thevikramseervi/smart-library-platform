# Smart Library Platform

An AI-powered, cloud-based Library Management System built as a final-year engineering project.

This README describes the **currently implemented system** as of Sprint 4.7. Planned capabilities (digital resources, QR, AI, notifications, and more) are listed separately and are **not yet available**.

---

## Project Overview

Smart Library Platform is a web application for managing a physical library catalog, inventory, circulation, reservations, fines, and role-based administration. It provides separate experiences for **Admin**, **Librarian**, and **Student** users through a React frontend and a FastAPI backend backed by PostgreSQL.

**Live stack (implemented):**

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Zustand, TanStack Query
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic, JWT authentication
- **Database:** PostgreSQL (local Docker or Neon)

---

## Current Features (Implemented)

| Module | Capabilities |
|--------|--------------|
| **Authentication & RBAC** | JWT login, role-based route and API protection (Admin, Librarian, Student) |
| **User Management** | Admin CRUD for users, password reset, soft delete, role/department assignment |
| **Department Management** | Admin CRUD for academic departments |
| **Catalog Management** | Books, authors, categories, publishers, languages |
| **Inventory / Physical Copies** | Book copies, inventory codes, copy lifecycle (`AVAILABLE`, `BORROWED`, `LOST`, `DAMAGED`, `RETIRED`) |
| **Circulation** | Issue, return, active/overdue loans, student loan history |
| **Reservations** | FIFO reservation queue, reservation-aware issue/return UX |
| **Fines** | Automatic overdue fines (calendar days), unpaid-fine borrowing block, staff mark-paid |
| **Dashboards** | Role-specific home dashboards with KPIs and recent activity |

For API details see [`docs/api-spec.md`](docs/api-spec.md). For schema details see [`docs/database.md`](docs/database.md).

---

## Planned Features (Future Work)

The following are **design targets** documented in architecture materials but **not implemented** in the current codebase:

| Area | Status |
|------|--------|
| Digital Resources (PDF upload, R2 storage) | Sprint 5+ |
| Notifications | Sprint 5+ |
| QR-based issue/return workflows | Sprint 5+ |
| Semantic Search | Future |
| Recommendation Engine | Future |
| Analytics dashboards | Future |
| Audit Logs | Future |
| Ratings & Reviews | Future |
| Library calendar / working-day fines | Future |
| Book renewal | Future |
| Token refresh / server-side logout | Future |

---

## Getting Started

Full setup and troubleshooting: [`docs/setup.md`](docs/setup.md)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for local PostgreSQL)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (frontend package manager)
- Node.js 20+ (for frontend)

### Option A — Local Docker PostgreSQL

From the repository root:

```bash
docker compose up -d

cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
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
3. Set `DATABASE_URL` in `backend/.env`:

   ```text
   DATABASE_URL=postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

4. From `backend/`:

   ```bash
   uv sync
   uv run alembic upgrade head
   uv run python -m app.db.seed    # local/dev only — see docs/setup.md
   uv run uvicorn app.main:app --reload --port 8000
   ```

5. Configure and start the frontend as in Option A.

See [`docs/setup.md`](docs/setup.md) for Neon SSL notes, CORS, and troubleshooting.

---

## Development Credentials

Created by `uv run python -m app.db.seed` (local development only):

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

---

## Screenshots

> Placeholder sections — add images under `docs/screenshots/` when available.

### Login

<!-- ![Login](docs/screenshots/login.png) -->

Branded two-column login with dev account helper (development mode only).

### Student Dashboard

<!-- ![Student Dashboard](docs/screenshots/student-dashboard.png) -->

Welcome header, loan/reservation/fine KPIs, recent activity, quick actions.

### Librarian Dashboard

<!-- ![Librarian Dashboard](docs/screenshots/librarian-dashboard.png) -->

Circulation metrics and recent transactions.

### Admin Dashboard

<!-- ![Admin Dashboard](docs/screenshots/admin-dashboard.png) -->

User/catalog metrics and recent platform activity.

### User Management

<!-- ![User Management](docs/screenshots/admin-users.png) -->

Admin user list and create/edit forms.

### Catalog

<!-- ![Catalog](docs/screenshots/catalog-books.png) -->

Book list, detail, and staff catalog management.

### Circulation

<!-- ![Circulation](docs/screenshots/circulation-issue.png) -->

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
| Backend | Python 3.12+, FastAPI, Uvicorn, SQLAlchemy, Alembic, Psycopg, Pydantic, python-jose, Passlib |
| Database | PostgreSQL 16 (Docker Compose or Neon) |
| Tooling | uv, pnpm, Git |

### Planned (not yet integrated)

- pgvector, Sentence Transformers, scikit-learn (semantic search / recommendations)
- Cloudflare R2 (digital resources)
- Recharts (analytics charts — dependency present but unused)

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
