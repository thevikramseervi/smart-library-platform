# Smart Library Platform - Architecture Document

**Implementation snapshot:** 2026-11-10 (Alembic head `022_digital_resources`)

## 1. Project Overview

Smart Library Platform is a cloud-based Library Management System developed as a final-year engineering project.

The current implementation manages physical books, catalog metadata, circulation, reservations, fines, ratings, semantic search, admin user/department management, and role-based dashboards.

Staff QR label printing and issue/return scanning are implemented. Staff can attach one private PDF to a catalog title in Cloudflare R2; authenticated users can open or download it from book details when storage is configured. Admin circulation reports and audit history for catalog and digital resources, copies, reference data, departments, user administration, circulation, reservation lifecycle, fines, and circulation policy changes are implemented; broader analytics remain future work. Semantic book search, ratings and reviews, student recommendations, and in-app circulation notifications are implemented.

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

* Broader analytics dashboards and trends beyond circulation reports
* Library calendar support for closure-aware due dates or fines
* Token refresh and explicit server-side logout

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
* Receive issue/return confirmations, due-soon and overdue reminders, reservation-ready alerts, and fine notifications
* Student dashboard

### Future Student/Staff Capabilities

* A custom in-app PDF reader (PDFs currently open in the browser's built-in viewer or download)
* Student self-service QR circulation; QR label printing and staff scanning are implemented

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

The catalog opens digital PDFs in the browser's built-in PDF viewer and supports downloading; a custom embedded PDF reader is not implemented. Broader analytics charts are future work. Admin circulation reports and an audit log page are implemented. Staff QR label printing and copy scanning are implemented in the frontend.

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

* Broader analytics beyond the implemented circulation and reservation charts

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

* **User Management** — CRUD, soft delete, admin password reset, self-service password change, role/department validation
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

### Library Analytics

The admin-only `/admin/analytics` page calls `GET /reports/circulation` with a
UTC calendar date range. It reports issues, returns, overdue loans as of the
period end, on-time and late returns, overdue age buckets, current unpaid fine
balance, reservation placements and outcomes, average reservation wait,
department borrowing participation, and the most-issued titles and categories.
It charts loans versus returns, fines collected, and reservation placements
versus fulfillments over the selected range; the aggregation interval adjusts
from daily to weekly or monthly as the range grows. Department participation
uses currently active students and current department assignments, and only
aggregate counts are exposed. Collection health also shows current copy counts
by status, titles whose active reservation queue exceeds copies already held
for reservations plus available copies, and titles with available stock but no
issues in the selected period. These inventory figures are current state; the
zero-issue signal is period-specific and is not a recommendation to remove a
title. Admins can download the selected report data as a spreadsheet-friendly
CSV generated in the browser. Broader analytics remain future work.

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
* Loans page shows a queue dialog after return for fulfillment awareness
* Reservation responses include nested `student` summary

Server-side enforcement:

* Returns hold the copy as `RESERVED` while a queue is waiting; the first queued student fulfills it on issue
* Issues to a queued book require the borrower to be first in the queue or an explicit `bypass_reservation=true`
* Expired reservations are processed before issue/return queue decisions; cancelling/expiring the last reservation releases held copies back to `AVAILABLE`
* Staff loans are managed in one Loans view with All and Overdue filters, backend search, QR scanning, pagination, and return confirmation. Returning an overdue copy can record fine payment and surfaces the next reservation in the queue.

### Fine Workflow (Sprint 4)

Calendar-day overdue balances accrue for open overdue loans when fine lists, dashboards, or issue eligibility are checked, clamped to `max_fine_amount`. The same fine is finalized on return; staff can mark it paid only after return. Payment is exactly-once via a conditional update. INR display in frontend.

### Circulation Policy Management Module (Sprint 4.9)

Provides database-backed circulation configuration for loan duration, reservation expiry, fine rate and cap, and active loan limit:

* **Database schema:** `circulation_policies` table (migration `013_circulation_policies`) with check constraints ensuring non-negative fines, positive loan windows, and positive borrowing limits.
* **Latest-editor attribution:** `updated_by` points to the user who last changed the policy; the UI shows this attribution. Each successful policy change is also recorded in the admin audit log with before/after values.
* **Concurrency:** `CirculationPolicyRepository.update_active` uses row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrent race conditions on policy updates.
* **Service integration:**
  * `FineService.sync_open_overdue_fines`: refreshes the accrued balance from `policy.daily_overdue_fine_rate` and `policy.max_fine_amount`.
  * `FineService.create_overdue_fine`: finalizes the accrued fine on return using the return date.
  * `TransactionService.issue_copy`: uses `policy.loan_period_days` and `policy.max_active_loans`.
  * `ReservationService.create_reservation`: uses `policy.reservation_expiry_days`.
* Fine rate and cap are read when a late book is returned. A policy edit during an open loan therefore applies to that loan's fine; the policy is not snapshotted at issue time.
* The policy also controls the maximum number of renewals per loan (0–5); a zero limit disables renewals.
* **Zero-downtime fallback:** If no active policy record exists in the database, the repository seamlessly falls back to static runtime `Settings`.

### Audit Log

The admin-only `/admin/audit-log` page reads `GET /audit-logs`. It lists
successful book and copy create/update/delete/status changes, user creation,
updates, deactivation and password resets, book issues/returns/renewals,
reservation creation/cancellation/expiry/fulfillment, fine recordings/payments,
and circulation-policy changes. Events are inserted in the same database
transaction as the action, so a failed action does not leave a success record
and a committed action cannot silently omit its audit event. It includes
reservation creation, cancellation, automatic expiration, and fulfillment
during issue; automatic expiry is attributed to System. The list supports
search, action/date filters, and pagination. Actor name/email snapshots remain
available if an account is later removed. Events are read-only through the API;
actions that occurred before the audit-log migration are not backfilled.
* **Admin UI:** Dedicated interface at `/admin/circulation-policy` with form validations, reset controls, error retry boundary, and contextual policy guidelines.

### Semantic Search Module (Sprint 5)

* Canonical text per book built from title/authors/categories/publisher/language/year/description (`app/search/document_builder.py`)
* Embeddings via FastEmbed ONNX (`BAAI/bge-small-en-v1.5`, 384-dim), lazy-loaded per process
* Catalog book create/update and author/category/publisher renames or soft deletions mark affected embeddings `PENDING` and schedule targeted background reindexing after the response; deleted reference data is omitted from canonical text. Failures remain recorded for admin retry in the app or the offline command: `uv run python -m app.scripts.reindex_embeddings` (batched, per-book failure tracking, `--force` to re-embed unchanged)
* Admins can inspect indexing counts and start a pending/failed retry or confirmed full rebuild at `/admin/search-index`; matching admin-only API endpoints report job outcome while the server process remains running
* Soft delete removes the embedding row
* `GET /api/v1/books/search?q=` prioritizes exact title/ISBN, title-prefix, and other catalog text matches before semantically ranked results. ISBN-shaped queries use text matching only; other queries apply BGE v1.5's query instruction, keep pending/stale books findable through text matches, diversify leading semantic results across titles while retaining editions, and fall back to text if no usable vectors exist or inference fails
* Smart-search toggle on the frontend books catalog renders scored results

### Ratings Module (Sprint 5)

* One 1-5 rating and optional written review per student per book (migrations `012` and `021`, UNIQUE constraint + CHECK constraints)
* Upsert via ON CONFLICT so concurrent double-posts are deterministic
* Endpoints: `PUT`/`DELETE /books/{id}/rating` (student-only), `GET /books/{id}/ratings` summary, `GET /books/{id}/ratings/me`, `GET /books/{id}/reviews`, and student-only `PUT`/`DELETE /books/{id}/review`
* Students can add or edit a review after rating a book; authenticated users see the public review list on book details
* Star picker with live average/count and review editor for students; admins and librarians see reviews read-only

---

## 10. Additional Architecture Notes

QR circulation and digital library workflows below are implemented. The recommendations section describes the current implementation; broader analytics remain future work.

### QR-Based Circulation

Staff can print a label for one or all physical copies from the book detail page. The frontend generates a QR image locally from the copy's existing `qr_code_value` (currently the inventory code); it is not stored as an image and requires no database migration. Issue and return pages can scan the label using the camera, then use the scanned inventory code to filter the existing copy or active-loan list. The existing student selection, reservation, fine, and confirmation checks still apply. Manual search remains available.

### Digital Library

```text
Authenticated API → private Cloudflare R2 object
                    ↘ PostgreSQL metadata and opaque key
```

Staff can upload, replace, or remove one PDF (up to 25 MB) for a catalog title.
Authenticated users can open or download it from the book detail page. File
bytes remain in R2; PostgreSQL stores only metadata and the private object key.

### Recommendations

The student-only `GET /recommendations/me` endpoint ranks active catalog titles
with an available copy that the student has not rated, borrowed, or dismissed.
Students can choose “More like this” or
“Not interested” on dashboard recommendations. Feedback is saved per student
and title; likes strengthen semantic and category preferences and remain marked
on their recommendation cards, while dismissed titles are excluded from future
recommendations. Students can replace or clear
their feedback through the recommendation API. The service reuses current
indexed FastEmbed vectors to compare candidates with positively rated, borrowed,
or liked titles, then blends semantic similarity with category interest,
circulation popularity, and average ratings. A diversity penalty reduces
near-duplicate suggestions in the result list. If a suitable vector is missing,
the service falls back to the available category, popularity, and rating signals;
it does not load the embedding model or generate vectors during a dashboard
request. Each result includes a short reason, category, rating summary, cover,
availability, and a link to book details. The dashboard displays six at a time
and can browse the next ranked suggestions in place, up to the endpoint's limit
of twenty.

### In-App Notifications (Implemented)

Persistent, user-scoped in-app alerts for issued and returned books, due-soon
and overdue loans, reservation-ready copies, overdue fines, and fine payments.
The notification center supports unread counts and read state.
Due and overdue reminders are generated when the authenticated user opens the
app; no background scheduler, email provider, or push service is required.

### Broader Analytics (Future)

Trend dashboards beyond the implemented date-filtered circulation reports and
Sprint 4.6 operational role dashboards.

---

## 11. Deployment Architecture

```text
React Frontend → Vercel
FastAPI Backend → Render (current deployment)
PostgreSQL → Neon
```

See [`deployment.md`](deployment.md) for environment variables and checklist.

Digital PDF storage uses a private Cloudflare R2 bucket. The Render backend
must have the `CLOUD_STORAGE_*` settings configured, and the target database
must be migrated through `022_digital_resources`.

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

Physical library catalog and inventory, digital PDF files, circulation, reservations, fines, ratings and reviews, recommendations, semantic search, admin users/departments, role dashboards, reservation-aware staff UX, catalog/reference-data/department/user/circulation/policy audit history.

### Excluded / Future

Payment gateway, multi-branch libraries, RFID, microservices, AI chatbots, and analytics beyond circulation reports.

---

## 14. Development Tools

* Cursor, Git, GitHub
* uv (Python), pnpm (frontend)

Setup: [`setup.md`](setup.md)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`api-spec.md`](api-spec.md) | REST API (implemented + future endpoints) |
| [`database.md`](database.md) | Schema (implemented + planned) |
| [`sprint-4-summary.md`](sprint-4-summary.md) | Sprint delivery history |
| [`project-rules.md`](project-rules.md) | Engineering standards |
