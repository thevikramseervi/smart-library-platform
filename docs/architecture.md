# Smart Library Platform - Architecture Document

**Version:** Sprint 4.8

## 1. Project Overview

Smart Library Platform is a cloud-based Library Management System developed as a final-year engineering project.

The **implemented system** (Sprint 4.7) manages physical books, catalog metadata, circulation, reservations, fines, admin user/department management, and role-based dashboards.

Advanced capabilities (digital resources, QR scanning, AI search, notifications, analytics) are **planned** and documented separately as future architecture.

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
* AI-powered recommendations and semantic search
* Notifications and analytics dashboards
* Audit logging

---

## 3. User Roles

### Admin (Implemented)

* Manage users and departments
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
* Ratings, reviews, recommendations
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
| Auth | JWT (python-jose), Passlib/bcrypt |
| Tooling | uv, pnpm, Git |

### Planned (Not Integrated)

* pgvector, Sentence Transformers (semantic search)
* Cloudflare R2 (digital files)
* Recharts (analytics UI — dependency present, unused)
* scikit-learn / Pandas (recommendations)

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

Frontend route guards (`AdminRoute`, `StaffRoute`, `ProtectedRoute`) improve UX; **backend RBAC is authoritative**.

**Not implemented:** token refresh, server-side logout.

---

## 9. Implemented Modules

### Admin Module (Sprint 4.5)

* **User Management** — CRUD, soft delete, password reset, role/department validation
* **Department Management** — CRUD, delete protection when users assigned

Frontend: `/admin/users`, `/admin/departments`

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

### Circulation Module (Sprint 4)

* Issue and return transactions
* Active/overdue loan tracking
* Fine creation on late return
* Unpaid fine borrowing block

### Reservations Module (Sprint 4)

* FIFO queue per book
* Student reserve when unavailable
* Staff queue visibility

### Reservation-Aware Circulation (Sprint 4.3)

Staff issue/return workflows surface active reservation queues:

* Issue page warns when queue exists for selected copy's book
* Return page shows queue dialog for fulfillment awareness
* Reservation responses include nested `student` summary

### Fine Workflow (Sprint 4)

Calendar-day overdue calculation. Staff mark fines paid. INR display in frontend.

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

### AI / Semantic Search (Future)

```text
Book metadata → Sentence Transformer → pgvector → similarity search
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

### Included (Implemented through Sprint 4.7)

Physical library catalog and inventory, circulation, reservations, fines, admin users/departments, role dashboards, reservation-aware staff UX.

### Excluded / Future

Payment gateway, multi-branch libraries, RFID, microservices, AI chatbots, digital resources, notifications, QR, semantic search, recommendations, audit logs, analytics.

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
