# Smart Library Platform - Architecture Document

**Implementation snapshot:** 2026-11-09 (Alembic head `015_book_renewals`)

## 1. Project Overview

Smart Library Platform is a cloud-based Library Management System developed as a final-year engineering project.

The current implementation manages physical books, catalog metadata, circulation, reservations, fines, ratings, semantic search, admin user/department management, and role-based dashboards.

Advanced capabilities (digital resources, QR scanning, recommendations, notifications, and analytics) are **planned** and documented separately as future architecture. Semantic book search and ratings are implemented.

---

## 2. Objectives

### Implemented Objectives

* Manage library books and physical inventory
* Manage students, librarians, and administrators
* Support issue, return, and reservation workflows
* Manage fines and borrowing history
* Admin user and department management
* Role-based dashboards

### Future Objectives (Not Yet Built)

* QR-based issue and return
* Digital books and cloud storage
* AI-powered recommendations
* Notifications and analytics dashboards
* Audit logging

---

## 3. User Roles

### Admin (Implemented)

* Manage users and departments
* Manage dynamic circulation policies (fine rates, caps, loan durations, and borrowing limits)
* Full catalog and circulation staff access
* Platform dashboard with user and circulation activity

### Librarian (Implemented)

* Manage catalog (books, copies, reference data)
* Issue and return books
* Manage reservations and fines
* Librarian dashboard

### Student (Implemented)

* Browse catalog and view availability
* Borrow books (via staff issue)
* Reserve unavailable books
* View loans, reservations, and fines
* Student dashboard

### Future Student/Staff Capabilities

* Digital resource viewing
* Reviews and recommendations (ratings are live)
* QR self-service (if added)
* In-app notifications

---

## 4. System Architecture

```text
Frontend (React + Vite)
        ↓ REST + JWT
Backend API (FastAPI, layered)
        ↓ SQLAlchemy
PostgreSQL (Docker local or Neon)
```

### Frontend Layer

Responsible for:

* User interface and routing
* Authentication UI (login, JWT storage)
* Role-based dashboards
* Catalog, circulation, and admin modules
* TanStack Query data fetching

Not yet implemented: QR scanning, PDF viewer, analytics charts, notification center.

### Backend Layer

Layered architecture:

```text
API Layer (routers)
    ↓
Service Layer (business logic)
    ↓
Repository Layer (queries)
    ↓
Database Layer (PostgreSQL)
```

### Database Layer

Alembic-managed PostgreSQL schema. See [`database.md`](database.md) for implemented vs planned tables.

---

## 5. Technology Stack

### In Production Use

| Layer | Technologies |
|-------|--------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Zustand, TanStack Query, Axios |
| Backend | Python, FastAPI, Uvicorn, Pydantic, SQLAlchemy, Alembic, Psycopg |
| Database | PostgreSQL 16 (Docker or Neon) |
| Auth | JWT (PyJWT), bcrypt |
| Semantic search | FastEmbed (bge-small-en-v1.5 ONNX) + pgvector HNSW cosine |
| Tooling | uv, pnpm, Git |

### Planned (Not Integrated)

* Cloudflare R2 (digital files)
* Recommendation algorithms
* Analytics visualization library (no charts are implemented)

---

## 6. Frontend Architecture

```text
frontend/src/
├── pages/          # login, dashboard, catalog, circulation, admin
├── layouts/        # MainLayout, CatalogLayout, CirculationLayout, AdminLayout
├── routes/         # React Router configuration
├── services/       # Axios API clients
├── store/          # Zustand (auth)
├── components/     # Shared UI and auth guards
└── types/          # TypeScript contracts
```

State: Zustand for auth; TanStack Query for server state.

---

## 7. Backend Architecture

Routers in `app/api/v1/endpoints/` delegate to services in `app/services/` and repositories in `app/repositories/`.

**Rule:** No business logic in routers.

---

## 8. Authentication & Authorization (Implemented)

```text
Login (POST /auth/login)
    ↓
Password verification (bcrypt)
    ↓
JWT issued
    ↓
Bearer token on authenticated requests
    ↓
require_roles() / get_current_user dependencies
```

Roles: `ADMIN`, `LIBRARIAN`, `STUDENT`.

Frontend route guards (`AdminRoute`, `StaffRoute`, `ProtectedRoute`) improve UX; **backend RBAC is authoritative**. Zustand persists the access token and user profile in browser local storage. Client logout clears that state and the TanStack Query cache; it does not revoke the token server-side.

Session security:

* JWTs carry a `token_version` claim checked against `users.token_version`; password resets and changes invalidate outstanding tokens immediately
* Access tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30); no refresh endpoint is implemented
* Failed logins are locked out per account and per IP after `LOGIN_RATE_LIMIT_ATTEMPTS` failures within the window
* Login rate-limit state is in process memory; it is not shared across API workers/replicas and resets on process restart
* Startup validation rejects weak or default `JWT_SECRET_KEY` values

**Not implemented:** token refresh endpoint, explicit server-side logout (revocation currently happens on credential changes).

---

## 9. Implemented Modules

### Admin Module (Sprint 4.5, 4.9)

* **User Management** — CRUD, soft delete, password reset, role/department validation
* **Department Management** — CRUD, delete protection when users assigned
* **Circulation Policy Management** — Dynamic configuration of daily overdue fine rates, max fine amounts, loan durations, active loan limits, and reservation hold expiries, with attribution for the latest editor.

Frontend: `/admin/users`, `/admin/departments`, `/admin/circulation-policy`

### Dashboard Module (Sprint 4.6–4.7)

Role-specific summary endpoints and views:

| Role | API | UI |
|------|-----|-----|
| Student | `GET /dashboard/student` | Loans, reservations, fines KPIs |
| Librarian | `GET /dashboard/librarian` | Catalog/circulation KPIs |
| Admin | `GET /dashboard/admin` | User and platform KPIs |

Home route `/` redirects to `/dashboard`.

### Catalog Module (Sprint 3)

Books, authors, categories, publishers, languages, physical copies with lifecycle statuses.

### Circulation Module (Sprint 4, 4.9)

* Issue and return transactions with row-level locking (`SELECT ... FOR UPDATE` on student and copy rows)
* Student self-service loan renewal, with an admin-configured per-loan limit (default one; zero disables), overdue/fine/queue checks, and due-date extension from the existing due date
* Active/overdue loan tracking on the UTC calendar
* Fine creation on late return, calculated using active `CirculationPolicy` (or fallback to `Settings`), capped at `max_fine_amount`
* Unpaid fine borrowing block and per-student concurrent loan limit (`max_active_loans`)

### Reservations Module (Sprint 4)

* FIFO queue per book, one active reservation per student per book (DB-enforced partial unique index)
* Student reserve when unavailable
* Staff queue visibility

### Reservation-Aware Circulation (Sprint 4.3)

Staff issue/return workflows surface active reservation queues:

* Issue page warns when queue exists for selected copy's book
* Return page shows queue dialog for fulfillment awareness
* Reservation responses include nested `student` summary

Server-side enforcement:

* Returns hold the copy as `RESERVED` while a queue is waiting; the first queued student fulfills it on issue
* Issues to a queued book require the borrower to be first in the queue or an explicit `bypass_reservation=true`
* Expired reservations are processed before issue/return queue decisions; cancelling/expiring the last reservation releases held copies back to `AVAILABLE`
* Return Book supports backend search across book title, inventory code, and student identity, plus pagination

### Fine Workflow (Sprint 4)

Calendar-day overdue balances accrue for open overdue loans when fine lists, dashboards, or issue eligibility are checked, clamped to `max_fine_amount`. The same fine is finalized on return; staff can mark it paid only after return. Payment is exactly-once via a conditional update. INR display in frontend.

### Circulation Policy Management Module (Sprint 4.9)

Provides database-backed circulation configuration for loan duration, reservation expiry, fine rate and cap, and active loan limit:

* **Database schema:** `circulation_policies` table (migration `013_circulation_policies`) with check constraints ensuring non-negative fines, positive loan windows, and positive borrowing limits.
* **Latest-editor attribution:** `updated_by` points to the user who last changed the policy; the UI shows this attribution. There is no history of prior policy values or a general audit log.
* **Concurrency:** `CirculationPolicyRepository.update_active` uses row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrent race conditions on policy updates.
* **Service integration:**
  * `FineService.sync_open_overdue_fines`: refreshes the accrued balance from `policy.daily_overdue_fine_rate` and `policy.max_fine_amount`.
  * `FineService.create_overdue_fine`: finalizes the accrued fine on return using the return date.
  * `TransactionService.issue_copy`: uses `policy.loan_period_days` and `policy.max_active_loans`.
  * `ReservationService.create_reservation`: uses `policy.reservation_expiry_days`.
* Fine rate and cap are read when a late book is returned. A policy edit during an open loan therefore applies to that loan's fine; the policy is not snapshotted at issue time.
* The policy also controls the maximum number of renewals per loan (0–5); a zero limit disables renewals.
* **Zero-downtime fallback:** If no active policy record exists in the database, the repository seamlessly falls back to static runtime `Settings`.
* **Admin UI:** Dedicated interface at `/admin/circulation-policy` with form validations, reset controls, error retry boundary, and contextual policy guidelines.

### Semantic Search Module (Sprint 5)

* Canonical text per book built from title/authors/categories/publisher/language/year/description (`app/search/document_builder.py`)
* Embeddings via FastEmbed ONNX (`BAAI/bge-small-en-v1.5`, 384-dim), lazy-loaded per process
* Catalog book create/update and author/category/publisher renames mark affected embeddings `PENDING` and schedule targeted background reindexing after the response; failures remain recorded for admin retry in the app or the offline command: `uv run python -m app.scripts.reindex_embeddings` (batched, per-book failure tracking, `--force` to re-embed unchanged)
* Admins can inspect indexing counts and start a pending/failed retry or confirmed full rebuild at `/admin/search-index`; matching admin-only API endpoints report job outcome while the server process remains running
* Soft delete removes the embedding row
* `GET /api/v1/books/search?q=` prioritizes exact title/ISBN, title-prefix, and other catalog text matches before semantically ranked results. ISBN-shaped queries use text matching only; other queries apply BGE v1.5's query instruction, keep pending/stale books findable through text matches, diversify leading semantic results across titles while retaining editions, and fall back to text if no usable vectors exist or inference fails
* Smart-search toggle on the frontend books catalog renders scored results

### Ratings Module (Sprint 5)

* One 1-5 rating per student per book (migration `012`, UNIQUE constraint + CHECK on score range)
* Upsert via ON CONFLICT so concurrent double-posts are deterministic
* Endpoints: `PUT`/`DELETE /books/{id}/rating` (student-only), `GET /books/{id}/ratings` summary, `GET /books/{id}/ratings/me`
* Star picker with live average/count on the student book detail page

---

## 10. Future Architecture (Not Yet Implemented)

The sections below describe **planned** design. No production code paths exist yet.

### QR-Based Circulation (Sprint 5+)

```text
Scan Student QR → Scan Book QR → Issue
Scan Book QR → Return → Fine Calculation
```

Copy `qr_code_value` is stored today; QR API and scanner UI are not built.

### Digital Library (Sprint 5+)

```text
Cloudflare R2 → file URL → PostgreSQL metadata
```

### Recommendation Engine (Future)

Popularity, content-based, and collaborative filtering over borrow/rating signals.

### Notifications (Sprint 5+)

Due reminders, reservation availability, fine alerts.

### Analytics (Future)

Trend dashboards distinct from Sprint 4.6 operational role dashboards.

---

## 11. Deployment Architecture

```text
React Frontend → Vercel
FastAPI Backend → Render / Railway / Fly.io
PostgreSQL → Neon
```

See [`deployment.md`](deployment.md) for environment variables and checklist.

Digital resources (future) will add Cloudflare R2.

---

## 12. Non-Functional Requirements

### Security (Implemented)

* Password hashing (bcrypt)
* JWT authentication
* Role-based authorization on backend

### Scalability & Maintainability

* Layered backend
* TypeScript frontend
* Repository pattern
* UUID primary keys, soft deletes

---

## 13. Project Scope

### Included (Current Implementation)

Physical library catalog and inventory, circulation, reservations, fines, ratings, semantic search, admin users/departments, role dashboards, reservation-aware staff UX.

### Excluded / Future

Payment gateway, multi-branch libraries, RFID, microservices, AI chatbots, digital resources, notifications, QR, recommendations, audit logs, analytics.

---

## 14. Development Tools

* Cursor, Git, GitHub
* uv (Python), pnpm (frontend)

Setup: [`setup.md`](setup.md)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`api-spec.md`](api-spec.md) | REST API (implemented + planned appendix) |
| [`database.md`](database.md) | Schema (implemented + planned) |
| [`sprint-4-summary.md`](sprint-4-summary.md) | Sprint delivery history |
| [`project-rules.md`](project-rules.md) | Engineering standards |
