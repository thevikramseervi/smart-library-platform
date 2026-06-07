# Smart Library Platform - API Specification

**Version:** Sprint 4.8 (implemented surface)

## Overview

The backend exposes REST APIs using FastAPI.

Authentication is JWT-based. Only `POST /auth/login` and `GET /auth/me` are implemented today.

Authorization uses Role-Based Access Control (RBAC).

Roles:

* ADMIN
* LIBRARIAN
* STUDENT

Base URL:

```text
/api/v1
```

Planned endpoints that are **not yet implemented** are listed in [Appendix: Planned APIs](#appendix-planned-apis-not-yet-implemented) at the end of this document.

---

# Authentication APIs

## Login

```http
POST /api/v1/auth/login
```

Access:

```text
Public
```

Purpose:

```text
Authenticate user and return JWT token.
```

---

## Current User

```http
GET /api/v1/auth/me
```

Access:

```text
Authenticated Users
```

Purpose:

```text
Get current user profile.
```

> **Not yet implemented:** `POST /auth/refresh` and `POST /auth/logout` are planned for a future sprint. Clients currently store the JWT locally and clear it on logout.

---

# Dashboard

Role-specific summary endpoints. All return real aggregated data; no charts or analytics.

## Student Dashboard

```http
GET /api/v1/dashboard/student
```

Access:

```text
Student
```

Response: `200`

```json
{
  "active_loans": 1,
  "active_reservations": 0,
  "unpaid_fines": "10.00",
  "total_books_borrowed": 5,
  "recent_loans": [
    {
      "book_title": "Clean Code",
      "issued_at": "2026-06-01T10:00:00Z",
      "due_at": "2026-06-15",
      "status": "ISSUED",
      "is_overdue": false
    }
  ],
  "recent_reservations": [
    {
      "book_title": "Design Patterns",
      "queue_position": 2,
      "reservation_date": "2026-06-07T10:00:00Z"
    }
  ]
}
```

## Librarian Dashboard

```http
GET /api/v1/dashboard/librarian
```

Access:

```text
Librarian
```

Response: `200`

```json
{
  "books_count": 120,
  "copies_count": 340,
  "active_loans": 45,
  "overdue_loans": 3,
  "reservations_count": 12,
  "unpaid_fines_count": 8,
  "recent_transactions": [
    {
      "book_title": "Clean Code",
      "student_name": "Dev Student",
      "student_code": "STU-001",
      "action": "ISSUE",
      "occurred_at": "2026-06-07T09:00:00Z"
    }
  ]
}
```

## Admin Dashboard

```http
GET /api/v1/dashboard/admin
```

Access:

```text
Admin
```

Response: `200`

```json
{
  "users_count": 50,
  "students_count": 45,
  "librarians_count": 3,
  "departments_count": 2,
  "books_count": 120,
  "active_loans": 45,
  "recent_user_activity": [
    {
      "activity_type": "CREATED",
      "user_name": "John Doe",
      "email": "john@library.local",
      "role_name": "STUDENT",
      "occurred_at": "2026-06-07T08:00:00Z"
    }
  ],
  "recent_circulation_activity": [
    {
      "action": "RETURN",
      "book_title": "Clean Code",
      "student_name": "Dev Student",
      "occurred_at": "2026-06-07T09:30:00Z"
    }
  ]
}
```

---

# Roles

## List Roles

```http
GET /api/v1/roles
```

Access:

```text
Admin
```

Response: `200` — array of role summaries for admin forms.

```json
[
  { "id": "uuid", "name": "ADMIN" },
  { "id": "uuid", "name": "LIBRARIAN" },
  { "id": "uuid", "name": "STUDENT" }
]
```

---

# User Management

All user management endpoints are **Admin only**. Responses never include `password_hash`.

Shared response shape (`UserResponse`):

```json
{
  "id": "uuid",
  "email": "student@library.local",
  "first_name": "Dev",
  "last_name": "Student",
  "phone": null,
  "student_code": "STU-001",
  "semester": 4,
  "is_active": true,
  "role": { "id": "uuid", "name": "STUDENT" },
  "department": { "id": "uuid", "name": "Computer Science", "code": "CSE", "description": "..." }
}
```

Role-specific validation:

| Role | `student_code` | `semester` | `department_id` |
|------|----------------|------------|-----------------|
| STUDENT | Required, unique | Required (≥ 1) | **Required** |
| LIBRARIAN | Must be null | Must be null | Optional |
| ADMIN | Must be null | Must be null | Optional |

Admin safety (HTTP `409`):

* Cannot delete, deactivate, or demote self
* Cannot delete, deactivate, or demote the last active ADMIN

## List Users

```http
GET /api/v1/users
```

Access:

```text
Admin
```

Query params: `page`, `page_size` (max 100), `q` (email, name, student_code), `role` (`ADMIN` | `LIBRARIAN` | `STUDENT`), `department_id`, `is_active`.

Response: `200` — `PaginatedResponse[UserResponse]`. Soft-deleted users are excluded.

## Get User

```http
GET /api/v1/users/{id}
```

Access:

```text
Admin
```

Response: `200` — `UserResponse`. Returns `404` for soft-deleted users.

## Create User

```http
POST /api/v1/users
```

Access:

```text
Admin
```

Request:

```json
{
  "role_id": "uuid",
  "department_id": "uuid-or-null",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@library.local",
  "phone": "+91-9876543210",
  "password": "securePassword123",
  "student_code": "STU-003",
  "semester": 3,
  "is_active": true
}
```

Response: `201` — `UserResponse`.

Errors: `404` invalid role/department · `409` duplicate email or student_code · `422` validation.

## Update User

```http
PUT /api/v1/users/{id}
```

Access:

```text
Admin
```

Request: partial fields (`role_id`, `department_id`, `first_name`, `last_name`, `email`, `phone`, `password`, `student_code`, `semester`, `is_active`). Omit `password` to leave unchanged.

Response: `200` — `UserResponse`.

## Reset User Password

```http
POST /api/v1/users/{id}/reset-password
```

Access:

```text
Admin
```

Request:

```json
{ "password": "newSecurePassword123" }
```

Response: `204 No Content`.

Admin-only password reset with no email workflow. Password is hashed server-side.

## Deactivate User

```http
DELETE /api/v1/users/{id}
```

Access:

```text
Admin
```

Behavior:

```text
Soft delete (sets deleted_at and is_active = false)
```

Response: `204 No Content`.

---

# Departments

All department endpoints are **Admin only**.

Shared response shape (`DepartmentResponse`):

```json
{
  "id": "uuid",
  "name": "Computer Science",
  "code": "CSE",
  "description": "Computer Science and Engineering"
}
```

## List Departments

```http
GET /api/v1/departments
```

Access:

```text
Admin
```

Response: `200` — `DepartmentResponse[]` ordered by `code`.

## Get Department

```http
GET /api/v1/departments/{id}
```

Access:

```text
Admin
```

Response: `200` — `DepartmentResponse`.

## Create Department

```http
POST /api/v1/departments
```

Access:

```text
Admin
```

Request:

```json
{
  "name": "Computer Science",
  "code": "CSE",
  "description": "Optional description"
}
```

Response: `201` — `DepartmentResponse`.

Errors: `409` duplicate `code`.

## Update Department

```http
PUT /api/v1/departments/{id}
```

Access:

```text
Admin
```

Request: partial `name`, `code`, `description`.

Response: `200` — `DepartmentResponse`.

## Delete Department

```http
DELETE /api/v1/departments/{id}
```

Access:

```text
Admin
```

Behavior:

```text
Hard delete only when no non-deleted users reference the department.
```

Response: `204 No Content`.

Errors: `409` when active users are assigned to the department.

---

# Publishers

## List Publishers

```http
GET /api/v1/publishers
```

Access:

```text
Authenticated Users
```

---

## Get Publisher

```http
GET /api/v1/publishers/{id}
```

Access:

```text
Authenticated Users
```

---

## Create Publisher

```http
POST /api/v1/publishers
```

Access:

```text
Admin, Librarian
```

---

## Update Publisher

```http
PUT /api/v1/publishers/{id}
```

---

## Delete Publisher

```http
DELETE /api/v1/publishers/{id}
```

---

# Languages

## List Languages

```http
GET /api/v1/languages
```

---

## Create Language

```http
POST /api/v1/languages
```

Access:

```text
Admin, Librarian
```

### Language management policy

Languages are **create-only** by design. There are no edit or delete endpoints.

Reference data such as language codes is shared across books and catalog filters. Allowing deletion or renaming would risk orphaned references and inconsistent historical records. New languages are added when needed; existing codes remain stable for the life of the catalog.

---

# Authors

## List Authors

```http
GET /api/v1/authors
```

---

## Get Author

```http
GET /api/v1/authors/{id}
```

---

## Create Author

```http
POST /api/v1/authors
```

Access:

```text
Admin, Librarian
```

---

## Update Author

```http
PUT /api/v1/authors/{id}
```

---

## Delete Author

```http
DELETE /api/v1/authors/{id}
```

---

# Categories

## List Categories

```http
GET /api/v1/categories
```

Access:

```text
Authenticated Users
```

---

## Get Category

```http
GET /api/v1/categories/{id}
```

Access:

```text
Authenticated Users
```

---

## Create Category

```http
POST /api/v1/categories
```

---

## Update Category

```http
PUT /api/v1/categories/{id}
```

---

## Delete Category

```http
DELETE /api/v1/categories/{id}
```

---

# Books

## List Books

```http
GET /api/v1/books
```

Supports:

```text
Pagination

Filtering

Sorting

Search
```

---

## Get Book

```http
GET /api/v1/books/{id}
```

---

## Create Book

```http
POST /api/v1/books
```

Access:

```text
Admin, Librarian
```

---

## Update Book

```http
PUT /api/v1/books/{id}
```

---

## Delete Book

```http
DELETE /api/v1/books/{id}
```

Behavior:

```text
Soft Delete
```

---

# Book Copies

## List Copies

```http
GET /api/v1/book-copies
```

Access:

```text
Admin, Librarian
```

Students use book-level availability on `GET /books/{id}` instead of copy-level records.

Query params:

* `book_id` (UUID) — filter copies for a book
* `status` — filter by `BookCopyStatus` (`AVAILABLE`, `BORROWED`, `RESERVED`, `LOST`, `DAMAGED`, `RETIRED`)

---

## Get Copy

```http
GET /api/v1/book-copies/{id}
```

Access:

```text
Admin, Librarian
```

---

## Create Copy

```http
POST /api/v1/book-copies
```

---

## Update Copy

```http
PUT /api/v1/book-copies/{id}
```

Staff may update copy `status`, `location`, and `acquired_date`. Status changes validate open loans and circulation-managed statuses (`BORROWED`, `RESERVED`).

> **Not yet implemented:** `GET /book-copies/{id}/qr` — QR image generation is planned for Sprint 5+. Copies store `qr_code_value` equal to `inventory_code` for future use.

---

# Transactions

## Issue Book

```http
POST /api/v1/transactions/issue
```

Access:

```text
Librarian, Admin
```

Request body (UUID pair **or** code pair — do not mix):

```json
{
  "book_copy_id": "uuid",
  "student_id": "uuid"
}
```

```json
{
  "inventory_code": "BK-...",
  "student_code": "STU-001"
}
```

Business rules:

* Copy must have status `AVAILABLE`.
* Student must not have any unpaid fines (409).
* Sets `due_at` to issue date + `LOAN_PERIOD_DAYS` (default 14).
* Overdue is derived at read time (`status=ISSUED` and `due_at < today`); there is no persisted `OVERDUE` status.

---

## Return Book

```http
POST /api/v1/transactions/return
```

Access:

```text
Librarian, Admin
```

Request body:

```json
{ "book_copy_id": "uuid" }
```

or

```json
{ "inventory_code": "BK-..." }
```

Business rules:

* Marks transaction `RETURNED`, sets copy back to `AVAILABLE`.
* If returned after `due_at`, creates an unpaid fine linked to the transaction.

---

## Transaction History

```http
GET /api/v1/transactions
```

Access:

```text
Librarian, Admin
```

Query params: `page`, `page_size`, `status` (`ISSUED` | `RETURNED`), `overdue` (bool), `student_id`, `book_id`.

---

## My Transaction History

```http
GET /api/v1/transactions/me
```

Access:

```text
Student
```

---

## My Active Loans

```http
GET /api/v1/transactions/me/active
```

Access:

```text
Student
```

Returns all open (`ISSUED`) loans for the authenticated student, including computed `is_overdue`.

---

## Student History

```http
GET /api/v1/transactions/student/{id}
```

Access:

```text
Librarian, Admin
```

---

## Get Transaction

```http
GET /api/v1/transactions/{id}
```

Access:

```text
Librarian, Admin, Student (own loans only)
```

---

# Circulation Helpers

## Search Students

```http
GET /api/v1/circulation/students/search?q={query}
```

Access:

```text
Librarian, Admin
```

Query param `q` is optional. When omitted, returns all active students (for client-side filtering in the issue workflow).

---

## List Available Copies

```http
GET /api/v1/circulation/copies/available
```

Access:

```text
Librarian, Admin
```

Query params: `book_id`, `q` (matches inventory code or book title).

---

# Reservations

## Create Reservation

```http
POST /api/v1/reservations
```

Access:

```text
Student
```

Request body:

```json
{ "book_id": "uuid" }
```

Business rules:

* Allowed only when the book has zero `AVAILABLE` copies.
* One active reservation per student per book.
* FIFO queue position is computed from `reservation_date` (not stored).

---

## Cancel Reservation

```http
DELETE /api/v1/reservations/{id}
```

Access:

```text
Student (own), Librarian, Admin
```

---

## My Reservations

```http
GET /api/v1/reservations/me
```

Access:

```text
Student
```

---

## List Reservations

```http
GET /api/v1/reservations
```

Access:

```text
Librarian, Admin
```

Query params: `page`, `page_size`, `book_id`, `status`.

---

## Reservation Queue

```http
GET /api/v1/reservations/queue/{book_id}
```

Access:

```text
Librarian, Admin
```

Returns active reservations for a book in FIFO order with computed `queue_position`.

Each reservation includes nested `book` and `student` summaries:

```json
{
  "id": "uuid",
  "student_id": "uuid",
  "book_id": "uuid",
  "reservation_date": "2026-06-07T10:00:00Z",
  "expiry_date": "2026-06-14T10:00:00Z",
  "status": "ACTIVE",
  "queue_position": 1,
  "book": { "id": "uuid", "title": "Clean Code" },
  "student": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "student_code": "STU-001"
  }
}
```

The same `student` summary is included on create, list, and `/reservations/me` responses.

---

# Fines

## My Fines

```http
GET /api/v1/fines/me
```

Access:

```text
Student
```

---

## List Fines

```http
GET /api/v1/fines
```

Access:

```text
Admin, Librarian
```

---

## Mark Fine Paid

```http
POST /api/v1/fines/{id}/pay
```

Access:

```text
Librarian, Admin
```

Business rules:

* Marks fine as paid and records `paid_at`.
* Unpaid fines block new book issues for that student (409 on issue).

---

# Health Check

## API Health

```http
GET /api/v1/health
```

Purpose:

```text
Service monitoring and deployment verification.
```

Response: `200` when API and database are healthy; `503` when database is unreachable.

---

# Appendix: Planned APIs (Not Yet Implemented)

The endpoints below are **design targets** for future sprints. They are **not registered** in the current FastAPI application.

## Authentication (Future)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/auth/refresh` | Token refresh |
| POST | `/api/v1/auth/logout` | Server-side logout |

## Book Copies (Future)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/book-copies/{id}/qr` | QR code image for copy |

## Digital Resources (Sprint 5+)

| Method | Path |
|--------|------|
| POST | `/api/v1/digital-resources` |
| GET | `/api/v1/digital-resources` |
| GET | `/api/v1/digital-resources/{id}` |

Requires Cloudflare R2 configuration (`CLOUD_STORAGE_*` env vars).

## Ratings & Reviews (Future)

| Method | Path |
|--------|------|
| POST | `/api/v1/ratings` |
| PUT | `/api/v1/ratings/{id}` |
| POST | `/api/v1/reviews` |
| PUT | `/api/v1/reviews/{id}` |
| DELETE | `/api/v1/reviews/{id}` |

## Notifications (Sprint 5+)

| Method | Path |
|--------|------|
| GET | `/api/v1/notifications` |
| POST | `/api/v1/notifications/{id}/read` |

## Analytics (Future)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/analytics/dashboard` | Superseded in design by role dashboards (`/dashboard/admin`); may be revisited |

## AI (Future)

| Method | Path |
|--------|------|
| GET | `/api/v1/recommendations/me` |
| GET | `/api/v1/search/semantic?q=...` |

Requires pgvector and embedding pipeline.

## Audit Logs (Future)

| Method | Path |
|--------|------|
| GET | `/api/v1/audit-logs` |

## Library Calendar (Future)

| Method | Path |
|--------|------|
| GET | `/api/v1/library-calendar` |
| POST | `/api/v1/library-calendar` |

Will support working-day fine calculation (currently fines use **calendar days**).

## Book Renewal (Future)

No endpoint defined yet. Renewal workflow is not implemented.

