# Sprint 4 Summary

Delivery history for the Smart Library Platform **Circulation & Administration** phase (Sprint 4 through 4.7), plus documentation alignment in Sprint 4.8.

Test counts are recorded at the time each sprint was completed and may increase in later sprints.

---

## Sprint 4 — Circulation & Reservations (Core)

**Focus:** Physical book circulation, reservations, fines, and RBAC.

### Features delivered

- Book issue and return (`POST /transactions/issue`, `/return`)
- Transaction history (staff and student views)
- Active loans and derived overdue detection
- Automatic overdue fines (calendar days × daily rate)
- Unpaid fine borrowing block
- FIFO reservation queue
- Student reservations when no copies available
- Circulation helper endpoints (student search, available copies)
- Role-based API and frontend route protection

### Major additions

- Circulation schema migration (`003_circulation_schema`)
- Frontend circulation module (issue, return, loans, fines, reservations)
- Acceptance test documentation (`docs/sprint-4-acceptance-tests.md`)

### Verification

- Backend pytest suite established for circulation
- Frontend build passing

---

## Sprint 4.1 — Hardening & Polish

**Focus:** Production-readiness fixes from Sprint 4 audit.

### Features delivered

- Reservation expiry persistence fix
- IntegrityError → HTTP 409 for concurrent issue/reservation
- RBAC hardening (students blocked from staff copy/transaction list endpoints)
- Frontend reservation UX fixes (queue page, reserve button gating, error handling)
- Student loan list privacy (inventory codes removed)

### Verification

- **48 pytest passed**
- `pnpm build` success

See [`sprint-4.1-completion-report.md`](sprint-4.1-completion-report.md).

---

## Sprint 4.2 — UX & Inventory Polish

**Focus:** INR formatting, return confirmation, copy lifecycle.

### Features delivered

- INR currency formatting on fine pages
- Return book confirmation dialog
- Book copy lifecycle: `LOST`, `DAMAGED`, `RETIRED` with validation rules
- Migration `004_book_copy_retired_status`
- Language create-only policy documented in API spec

### Verification

- **52 pytest passed**
- `pnpm build` success

See [`sprint-4.2-completion-report.md`](sprint-4.2-completion-report.md).

---

## Sprint 4.3 — Reservation-Aware Circulation UX

**Focus:** Staff visibility into reservation queues during issue/return.

### Features delivered

- `ReservationStudentSummary` on reservation API responses
- Post-return reservation queue dialog
- Issue workflow reservation warning and confirmation
- Reservation queue UI components
- Tests: `test_reservation_queue_awareness.py`

### Verification

- **55 pytest passed**
- `pnpm build` success

---

## Sprint 4.5 — Admin User & Department Management

**Focus:** Admin CRUD for users and departments.

### Features delivered

- `GET/POST/PUT/DELETE /users`, `POST /users/{id}/reset-password`
- `GET/POST/PUT/DELETE /departments`
- `GET /roles`
- Admin safety guards (self-delete, last admin protection)
- Student requires department; department delete blocked when users assigned
- Frontend admin module (`/admin/users`, `/admin/departments`)
- API contracts in `docs/api-spec.md`

### Verification

- **62 pytest passed**
- `pnpm build` success

---

## Sprint 4.6 — Role-Based Dashboard & Home Page

**Focus:** Role-specific dashboards as application home.

### Features delivered

- `GET /dashboard/student`, `/librarian`, `/admin`
- Dashboard repository, service, and schemas
- Frontend dashboard views per role
- Login redirects to `/dashboard`; `/` redirects to dashboard
- Navigation "Dashboard" link

### Verification

- **67 pytest passed**
- `pnpm build` success

---

## Sprint 4.7 — UX Polish & Professional Finish

**Focus:** Login redesign, dashboard UX, navigation polish (no API/schema changes).

### Features delivered

- Branded two-column login page with password toggle and dev credentials card
- Welcome headers and enriched KPI cards on dashboards
- Semantic status colors, quick action cards, empty states
- Sticky table headers, consistent date formatting
- Active navigation highlighting and compact role display

### Verification

- **67 pytest passed**
- `pnpm build` success

---

## Sprint 4.8 — Documentation & Deployment Alignment

**Focus:** Align all documentation with implemented system (this sprint).

### Deliverables

- README overhaul with Getting Started (Docker + Neon)
- `backend/README.md` populated
- `docs/setup.md` and `docs/deployment.md` created
- `docs/api-spec.md` cleaned (implemented vs planned)
- `docs/database.md` split (implemented vs planned schema)
- `docs/architecture.md` updated with current modules
- `docs/sprint-4-summary.md` (this document)

---

## Historical System Capabilities (End of Sprint 4.7)

The following section is a snapshot from the end of Sprint 4.7, not the current
feature list. Consult the root README and architecture document for current
capabilities.

### Backend API modules (implemented)

| Module | Endpoints |
|--------|-----------|
| Auth | Login, current user |
| Health | Service + DB health |
| Roles | List roles (admin) |
| Users | Full admin user management |
| Departments | Full admin department management |
| Catalog | Books, authors, categories, publishers, languages, book copies |
| Circulation | Issue, return, transaction history, helpers |
| Reservations | Create, cancel, list, queue |
| Fines | Student fines, staff list, mark paid |
| Dashboard | Student, librarian, admin summaries |

### Frontend modules (implemented)

| Area | Routes |
|------|--------|
| Login | `/login` |
| Dashboard | `/dashboard` |
| Catalog | `/catalog/*` |
| Circulation | `/circulation/*` (role-aware) |
| Admin | `/admin/users`, `/admin/departments` |

### Database tables (Alembic-managed)

`roles`, `departments`, `users`, `publishers`, `languages`, `authors`, `categories`, `books`, `book_authors`, `book_categories`, `book_copies`, `transactions`, `reservations`, `fines`

### Test suite

- **67 backend pytest tests** (as of Sprint 4.7)
- Frontend: `pnpm build` verification

### Not yet implemented (Sprint 5+)

Digital resources, notifications, QR workflows, ratings/reviews, semantic search, recommendations, analytics, audit logs, library calendar, token refresh/logout, book renewal.

### Current implementation update (2026-11-08)

Ratings, semantic search, and database-backed circulation policies have since
been implemented. Staff loan search and pagination are available in the return
workflow. Backend and frontend GitHub Actions workflows are present. Other
items in the historical Sprint 5+ list remain future work unless listed as
implemented in the current README and architecture document. Current backend
tests are broader than the historical 67-test count above; the suite was not
run during this documentation update.

### Current implementation update (2026-11-09)

Student loan renewals are now implemented with an admin-configurable limit,
defaulting to one renewal per loan. See the current README, architecture,
database, and API documents for the implemented rules.

### Current implementation update (2026-11-09, continued)

The admin audit log now also records book and physical-copy changes, user
creation/updates/deactivation, and password resets. Passwords and hashes are
never included. Department and standalone author, category, publisher, and
language creation/change actions are covered where the corresponding API
operation exists.

### Current implementation update (2026-11-10)

The later implementation now includes in-app circulation notifications, private
digital PDFs, student and copy QR workflows, ratings with written reviews,
semantic search and admin reindex controls, diversified student recommendations
with saved feedback, admin circulation reports, and policy-change audit events.
The current migration head is `024_recommendation_feedback`. This remains a
historical sprint document; consult the root README, architecture, API, and
database references for current behavior. Historical test totals above are not
verification of the current revision.

### Current implementation update (2026-11-11)

The current application adds backend request and stage timing headers, a
background semantic-model prewarm option, a short-lived per-process cache for
recommendation vectors, batched notification reminders, and reduced database
round trips for common dashboard, loan, and fine reads. Admin dashboards also
have a compact 30-day circulation overview endpoint. See the current backend
README, architecture, deployment, and API specification for behavior and
configuration. These additions do not change the database schema; the Alembic
head remains `024_recommendation_feedback`. This is a status note, not a claim
that the full test suite was run on this date.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [`sprint-4-acceptance-tests.md`](sprint-4-acceptance-tests.md) | QA acceptance criteria |
| [`sprint-4.1-completion-report.md`](sprint-4.1-completion-report.md) | Hardening details |
| [`sprint-4.2-completion-report.md`](sprint-4.2-completion-report.md) | Copy lifecycle details |
| [`setup.md`](setup.md) | Developer setup |
| [`deployment.md`](deployment.md) | Production deployment |
