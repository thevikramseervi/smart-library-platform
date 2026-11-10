# Smart Library Platform - API Specification

**Implementation snapshot:** 2026-11-10 (API prefix `/api/v1`)

## Overview

The backend exposes REST APIs using FastAPI.

Authentication is JWT-based. The implemented authentication endpoints are
`POST /auth/login` and `GET /auth/me`; the rest of the implemented API is
documented in the sections below. Login is rate limited (429 after repeated
failures), and tokens are revoked server-side when a user's password changes.

Authorization uses Role-Based Access Control (RBAC).

Roles:

* ADMIN
* LIBRARIAN
* STUDENT

Base URL:

```text
/api/v1
```

Additional implemented endpoints and future API designs are listed in the [additional API reference](#additional-api-reference) at the end of this document. Each section is labeled **Implemented** or **Future**; future endpoints are not registered in the current FastAPI application.

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

Business rules:

* Failed attempts are rate limited per account and per source IP: after
  `LOGIN_RATE_LIMIT_ATTEMPTS` failures within
  `LOGIN_RATE_LIMIT_WINDOW_SECONDS` (defaults 5 / 300s) the account returns
  `429 Too Many Requests` until the window elapses. A successful login
  clears the account's failure history.
* The limiter stores state in process memory. Lockout state is not shared across
  backend workers or replicas and is cleared when a process restarts.
* Password resets and password changes revoke all previously issued tokens
  for that user; the next request with an old token returns 401.

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

> **Not yet implemented:** `POST /auth/refresh` and `POST /auth/logout` are not registered. The browser persists the JWT in local storage and clears it on client-side logout; logout does not revoke the token server-side. Password reset/change increments `users.token_version` and does revoke existing tokens.

---

# Dashboard

Role-specific summary endpoints. These return real aggregated data; admin circulation reporting is documented separately below. Broader analytics charts are not implemented.

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

Business rules:

* Blocked with 409 while any copy of the book is `AVAILABLE` or `BORROWED`.
* Blocked with 409 while a digital PDF is attached; remove the PDF first so
  its private R2 object is not orphaned.
* Copies whose book is soft-deleted can no longer be issued; they are hidden
  from available-copy listings.

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

The frontend generates printable QR labels locally from `qr_code_value` (currently equal to `inventory_code`). No QR image API endpoint is used; camera scans pass the decoded inventory code into the existing issue/return search flows.

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

Optional flags:

* `bypass_reservation` (bool, default `false`) — staff-only escape hatch that
  allows issuing a copy of a book whose reservation queue is non-empty to a
  borrower who is not first in the queue.

Business rules:

* Copy must have status `AVAILABLE`, or `RESERVED` when the borrower is
  first in the book's reservation queue.
* Copies with status `LOST`, `DAMAGED`, or `RETIRED` can never be issued.
* If the book has an active reservation queue and the borrower is not the
  head of it, the request returns 409 unless `bypass_reservation` is true.
* Expired reservations are processed before the queue is checked; an expired
  entry cannot hold a copy or block a walk-up issue.
* Student must not have any unpaid fines (409).
* Student cannot already hold an open loan for the same book, even on a different copy (409).
* Student cannot exceed the active policy's `max_active_loans` concurrent-loan limit (default 5).
* Sets `due_at` to the issue date plus the active policy's `loan_period_days` (default 14). Runtime settings provide fallback values only when no active policy exists.
* Overdue is derived at read time (`status=ISSUED` and `due_at < today`
  on the UTC calendar); there is no persisted `OVERDUE` status.
* When the borrower has an active reservation for the book, it is marked
  `FULFILLED` and its id is recorded as `reservation_id` on the transaction.

---

## Renew Loan

```http
POST /api/v1/transactions/{transaction_id}/renew
```

Access: **Student**. A student can renew only their own loan; another student's
loan is reported as not found.

No request body is required. Response: `200` with the updated transaction,
including its new `due_at`, `renewal_count`, and current policy `max_renewals`.

Rules:

* The loan must still be active and not overdue.
* The student's account must have no unpaid fines.
* No active reservation queue may exist for the book.
* The loan must be below the active policy's `max_renewals` (default `1`; `0`
  disables renewals; admins can configure `0` through `5`).
* Each renewal adds the active policy's `loan_period_days` to the existing due
  date, so renewing early does not remove the remaining time.
* Ineligible renewals return `409 Conflict` with a reason.

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
{ "book_copy_id": "uuid", "pay_fine": false }
```

or

```json
{ "inventory_code": "BK-..." }
```

Business rules:

* Marks transaction `RETURNED` and records `returned_by` (the staff member
  processing the return).
* Copy status after return:
  * `RESERVED` when the book has an unexpired active reservation queue — the copy is
    held for the first queued student, who fulfills it on their next issue.
  * `AVAILABLE` otherwise.
* If returned after `due_at` (UTC calendar), creates an unpaid fine linked
  to the transaction: `days_late × daily_overdue_fine_rate` from the active
  policy, clamped to that policy's `max_fine_amount` (default ₹10/day and ₹500
  cap). Runtime settings provide fallback values only when no active policy
  exists.
* Optional `pay_fine: true` records payment of that finalized fine in the same
  return transaction. Omit or set false to return the book and leave the fine unpaid.
* Transaction responses include `fine_amount` when a fine exists. Open overdue
  balances are shown in the staff active-loan list and finalized in the return
  response so staff can confirm the amount due.

---

## Transaction History

```http
GET /api/v1/transactions
```

Access:

```text
Librarian, Admin
```

Query params: `page`, `page_size`, `status` (`ISSUED` | `RETURNED`), `overdue` (bool), `student_id`, `book_id`, `q` (case-insensitive search across book title, inventory code, and student name/code/email).

---

## My Transaction History

```http
GET /api/v1/transactions/me
```

Access:

```text
Student
```

Query params: `page`, `page_size`, and optional `status` (`ISSUED` or `RETURNED`).

---

## My Active Loans

```http
GET /api/v1/transactions/me/active
```

Access:

```text
Student
```

Returns all open (`ISSUED`) loans for the authenticated student, including computed
`is_overdue`. Responses may include `fine_amount` when an overdue balance has
accrued, and `fine_is_capped` indicates whether that balance has reached the
active policy's maximum fine amount (`null` when no fine exists).

The active-loan response omits `book_copy.inventory_code`. Inventory codes
remain in staff transaction and circulation responses.
It also includes `renewal_count` and the active policy's `max_renewals` so the
student can see how many renewals have been used.

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

Business rules:

* Only `ACTIVE` reservations can be cancelled (409 otherwise).
* Ownership is verified before state checks: students probing foreign
  reservation ids get 403/404, never queue-state information.
* Cancelling the last active reservation for a book releases any copy held
  as `RESERVED` for the queue back to `AVAILABLE`.

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

Query params: `page`, `page_size`, `paid`, `student_id`, and `q`. Search `q`
matches student name/code/email, book title, and physical copy inventory code.

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

* Fine responses include `is_accruing`, true while the linked book remains on an overdue open loan, and `is_capped`, true when that open loan's accrued fine has reached the active policy's maximum. Finalized fines are not marked as accruing or capped.
* Fine responses identify the borrower (`student_name`, `student_code`), title (`book_title`), physical copy (`inventory_code`), and loan `due_at` so staff can tell which circulation record the charge belongs to and when it was due.
* Open overdue balances are refreshed when fine lists, dashboards, or borrowing eligibility are read. The existing fine is finalized with the return date when the book is returned.
* An accruing fine cannot be paid until the book is returned (409).
* Marks fine as paid and records `paid_at`; the update is conditional on
  `paid = false`, so concurrent double-pay attempts return 409 instead of
  silently overwriting `paid_at`.
* Unpaid positive balances block new book issues for that student (409 on issue).

---

# Circulation Policies

## Get Active Policy

```http
GET /api/v1/circulation-policies
```

Access:

```text
Librarian, Admin
```

Response: `200`

```json
{
  "id": "7c88b97d-6f20-40e1-b4f0-4354c46f6631",
  "name": "Default Policy",
  "daily_overdue_fine_rate": "10.00",
  "max_fine_amount": "500.00",
  "loan_period_days": 14,
  "max_active_loans": 5,
  "max_renewals": 1,
  "reservation_expiry_days": 7,
  "is_active": true,
  "updated_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "updated_by_user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "first_name": "System",
    "last_name": "Admin",
    "email": "admin@library.local"
  },
  "created_at": "2026-09-07T12:00:00Z",
  "updated_at": "2026-09-07T12:00:00Z"
}
```

---

## Update Circulation Policy

```http
PUT /api/v1/circulation-policies
```

Access:

```text
Admin
```

Request body:

```json
{
  "daily_overdue_fine_rate": 15.00,
  "max_fine_amount": 600.00,
  "loan_period_days": 21,
  "max_active_loans": 5,
  "max_renewals": 1,
  "reservation_expiry_days": 7
}
```

Validation:
* `daily_overdue_fine_rate >= 0`
* `max_fine_amount >= 0`
* `max_fine_amount >= daily_overdue_fine_rate` (cap must be >= daily rate when positive)
* `1 <= loan_period_days <= 365`
* `1 <= max_active_loans <= 50`
* `0 <= max_renewals <= 5` (`0` disables renewal)
* `1 <= reservation_expiry_days <= 90`

Response: `200` (updated policy object including the latest editor attribution; prior values are not recorded).

---

# Semantic Search

## Search Books

```http
GET /api/v1/books/search
```

Access:

```text
Authenticated Users
```

Query params:

* `q` (required) — natural-language query, 1–512 chars
* `limit` (default `10`, max `50`)

Response: `200`

```json
{
  "query": "machine learning",
  "indexed_books": 190,
  "used_semantic": true,
  "text_match_count": 1,
  "results": [
    {
      "score": 0.7656,
      "id": "uuid",
      "title": "Machine learning",
      "cover_image_url": "https://covers.example.org/machine-learning.jpg",
      "publisher": "Example Academic Press",
      "isbn": "9780262018029",
      "publication_year": 2012,
      "authors": ["Kevin P. Murphy"],
      "categories": ["Machine Learning"],
      "total_copies": 4,
      "available_copies": 2
    }
  ]
}
```

Business rules:

* Results are ranked by cosine similarity over current-model vectors in the HNSW index when at least one is available (`used_semantic: true`). Vectors for pending, failed, deleted, or different-model books are excluded.
* A non-null `score` is the raw cosine similarity rounded to four decimal places. It is useful for comparing the ordering of results for the same query; it is not a calibrated relevance probability or confidence percentage. Results are not discarded using an absolute score threshold.
* Keyword matches are ordered first by exact title/ISBN, title prefix, title substring, then other title/ISBN/author/publisher matches. ISBN search ignores separators for full ISBN-length queries. A keyword result without a returned vector score has `score: null`; `text_match_count` counts those text-only results.
* ISBN-10 and ISBN-13 shaped queries bypass vector ranking and return catalog text matches only, avoiding unrelated semantic results for identifier input.
* Semantic candidates are over-fetched and diversified so the first results favor distinct titles. Additional editions remain in the response after the first occurrence of each title when they fit within `limit`.
* With `BAAI/bge-small-en-v1.5`, search queries receive the model's retrieval instruction prefix. Indexed book documents are embedded without that prefix; a query-instruction change does not require reindexing.
* If there are no usable current-model vectors or semantic inference fails, the endpoint returns keyword matches (`used_semantic: false`, `score: null` for every result). Inference failures are logged.
* Soft-deleted books never appear. The CLI command
  `uv run python -m app.scripts.reindex_embeddings` is available for offline
  indexing and recovery.
* Catalog writes mark their embedding row `PENDING`; this no longer disables vector ranking for the rest of the catalog. Reindexing adds the updated book back to semantic ranking.
* Book create and update schedule a targeted background embedding job after saving the catalog record. Search can use text matching while that job runs; a failure is recorded and can be retried from the admin UI or with the offline reindex command.
* Soft-deleting an author, category, or publisher omits that metadata from canonical embedding text, marks linked books `PENDING` in the same database transaction, then schedules targeted reindexing after the response.

## Admin Index Maintenance

```http
GET /api/v1/search-index/status
POST /api/v1/search-index/reindex
```

Access: **Admin only** for both endpoints. The status response reports active catalog total, indexed, pending, and failed books, the configured model, whether semantic search is enabled, and the latest manually requested job. Pending includes books without a usable current-model vector; failed is also reported separately.

`POST` accepts `{ "force": false }` to process missing, stale, pending, and failed embeddings, or `{ "force": true }` to regenerate every active book embedding. It returns `202` with a job ID. A second bulk job while one is running returns `409`; requests are also rejected with `409` while semantic search is disabled. The full rebuild requires explicit confirmation in the admin UI.

The admin interface is available at `/admin/search-index`. Job progress is held in server process memory; after a server restart, database indexing states remain available for a new retry, but the prior job's displayed outcome is lost. The CLI reindex command remains available for operations outside the app.

---

# Ratings

## Rating Summary

```http
GET /api/v1/books/{book_id}/ratings
```

Access:

```text
Authenticated Users
```

Response: `{ "book_id": "uuid", "average": 3.5, "count": 2 }`; `average` is `null` when unrated.

---

## My Rating

```http
GET /api/v1/books/{book_id}/ratings/me
```

Access:

```text
Student
```

Returns the caller's rating and optional `review_text`, or `null`.

---

## Rate a Book

```http
PUT /api/v1/books/{book_id}/rating
```

Access:

```text
Student
```

Request body: `{ "score": 1 }` (integer, 1–5).

Business rules:

* Upsert semantics via ON CONFLICT — re-rating updates the existing row, so concurrent double-posts are deterministic.
* Soft-deleted books return 404. Staff roles receive 403.

---

## Book Reviews

### List reviews

```http
GET /api/v1/books/{book_id}/reviews?page=1&page_size=10
```

Access: any authenticated user. Returns a paginated list of written reviews,
newest first. Each entry contains the rating score, review text, a display name
using the reviewer's first name and last initial, and creation/update timestamps.
Page size is limited to 50.

### Create or edit my review

```http
PUT /api/v1/books/{book_id}/review
```

Access: student. Request body: `{ "review_text": "..." }`; text is trimmed,
must contain non-whitespace characters, and is limited to 2,000 characters.
The student must already have a rating for the book (otherwise `409`). A review
is optional; rating alone remains supported.

### Remove my review

```http
DELETE /api/v1/books/{book_id}/review
```

Access: student. Returns `204` while keeping the star rating, or `404` if the
student has no written review. Removing the rating also removes its review.

---

## Remove My Rating

```http
DELETE /api/v1/books/{book_id}/rating
```

Access:

```text
Student
```

Returns `204`, or `404` when no rating exists.

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

# Additional API Reference

This reference contains endpoint details added after the core API sections above.
Sections labeled **Implemented** describe routes registered in the current
application. Sections labeled **Future** are design targets and are not
registered.

## Authentication (Future)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/auth/refresh` | Token refresh |
| POST | `/api/v1/auth/logout` | Server-side logout |

## Digital Resources (Implemented)

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/v1/digital-resources/books/{book_id}` | Any authenticated user |
| PUT | `/api/v1/digital-resources/books/{book_id}` | Admin or librarian; multipart PDF upload or replacement |
| GET | `/api/v1/digital-resources/books/{book_id}/content` | Any authenticated user; streams the private PDF |
| DELETE | `/api/v1/digital-resources/books/{book_id}` | Admin or librarian |

One PDF up to 25 MB may be attached to a book. Uploading a new PDF replaces
the previous file. PDF files are stored privately in Cloudflare R2; the API
does not expose the object key or a public URL. Set all `CLOUD_STORAGE_*`
variables to enable upload and retrieval. With storage unconfigured, metadata
queries still work, while upload and content retrieval return a service error.

## Notifications (Implemented)

All notification endpoints require authentication and only return or modify
records owned by the authenticated user.

### List recent notifications

```http
GET /api/v1/notifications
```

Returns up to 50 newest notifications and the current unread count. For
students, this also creates one reminder per active loan due today through the
next three days, or one overdue alert per past-due active loan. Alerts are
generated when the app is opened; no scheduled worker is used.

```json
{
  "unread_count": 1,
  "items": [
    {
      "id": "uuid",
      "notification_type": "DUE_SOON",
      "title": "Book due soon",
      "message": "Clean Code is due on 12 Nov 2026.",
      "link": "/circulation/my-loans",
      "created_at": "2026-11-09T08:00:00Z",
      "read_at": null
    }
  ]
}
```

Supported types: `BOOK_ISSUED`, `BOOK_RETURNED`, `RESERVATION_READY`,
`DUE_SOON`, `LOAN_OVERDUE`, `FINE_RECORDED`, and `FINE_PAID`. Issue and return
confirmations and fine records are saved in the same database transaction as
the circulation action.

### Mark one notification read

```http
POST /api/v1/notifications/{id}/read
```

Returns the updated notification. Returns `404` if the notification does not
belong to the authenticated user. Repeating the request is safe.

### Mark all notifications read

```http
POST /api/v1/notifications/read-all
```

Marks all unread notifications belonging to the authenticated user as read and
returns `204 No Content`.

## Circulation Reports (Implemented)

Admin-only circulation summary for a UTC calendar date range. Dates are
optional; the default range is the most recent 30 days ending today. The end
date cannot be in the future and the start date must not be after the end date.

```http
GET /api/v1/reports/circulation?start_date=2026-11-01&end_date=2026-11-09
```

Access: `Admin`

Response: `200`

```json
{
  "start_date": "2026-11-01",
  "end_date": "2026-11-09",
  "loans_issued": 18,
  "returns_processed": 14,
  "overdue_at_period_end": 3,
  "fines_collected": "250.00",
  "popular_books": [
    { "book_title": "Example Book", "loans_issued": 5 }
  ],
  "trend_interval": "day",
  "trend": [
    {
      "period_start": "2026-11-01",
      "loans_issued": 2,
      "returns_processed": 1,
      "fines_collected": "50.00"
    }
  ],
  "reservations_placed": 4,
  "reservations_fulfilled": 2,
  "reservations_expired": 1,
  "reservations_cancelled": 1,
  "average_reservation_wait_days": "2.30",
  "reservation_trend": [
    {
      "period_start": "2026-11-01",
      "reservations_placed": 2,
      "reservations_fulfilled": 1
    }
  ],
  "popular_categories": [
    { "category_name": "Computer Science", "loans_issued": 8 }
  ],
  "on_time_returns": 12,
  "late_returns": 2,
  "on_time_return_rate_percent": "85.7",
  "average_days_late": "4.5",
  "overdue_1_7_days_at_period_end": 1,
  "overdue_8_30_days_at_period_end": 1,
  "overdue_31_plus_days_at_period_end": 1,
  "current_unpaid_fine_balance": "780.00",
  "current_unpaid_fine_count": 3,
  "department_participation": [
    {
      "department_name": "Computer Science",
      "active_students": 20,
      "borrowing_students": 8,
      "participation_rate_percent": "40.0",
      "loans_issued": 14
    }
  ],
  "inventory_status": {
    "total_copies": 120,
    "available_copies": 70,
    "borrowed_copies": 35,
    "reserved_copies": 5,
    "out_of_service_copies": 10
  },
  "reservation_pressure_title_count": 1,
  "reservation_pressure_books": [
    {
      "book_title": "Example Book",
      "waiting_reservations": 4,
      "available_copies": 1,
      "reserved_copies": 2,
      "loans_issued": 8
    }
  ],
  "no_loan_title_count": 1,
  "no_loan_books": [
    { "book_title": "Another Example", "available_copies": 3 }
  ]
}
```

`overdue_at_period_end` is a point-in-time count for the selected end date;
`fines_collected` sums payments recorded within the selected date range. Trend
points use daily buckets for ranges up to 45 days, weekly buckets up to 180 days,
and monthly buckets for longer ranges. Buckets with no activity are returned as
zeroes so charts remain continuous. Reservation placements are grouped by
`reservation_date`; fulfilled, expired, and cancelled outcomes use the
reservation's `updated_at` timestamp, which is set when its status changes.
Average wait is measured from placement to fulfillment. Category issue counts
use each book's current category assignments, so a multi-category book's loan
appears under each category.
On-time return rate and late-return delay use the return timestamp's UTC date
compared with the due date. Overdue-age buckets are a point-in-time breakdown
at `end_date`; the unpaid fine balance/count are current values and include
refreshed accruals for currently overdue loans.
Department participation counts distinct currently active students who had at
least one issue during the selected period, divided by currently active,
department-assigned students. It uses current department assignments and does
not include student-level details.
Inventory status and reservation pressure describe current catalog/copy state,
not the selected date range. Reservation pressure counts active reservations
after subtracting copies already in `RESERVED` status, and flags a title when
the remaining waiting queue is greater than the number of currently available
copies. The response lists at most five highest-pressure titles and includes
the total matching title count. No-loan titles have at least one currently
available copy, no issue in the selected period, and no active reservation;
the response lists at most five, ordered by available copies, with a total
matching title count. A no-loan result is a review signal, not a removal
recommendation. Copy counts include active catalog titles only; out-of-service
copies combine `LOST`, `DAMAGED`, and `RETIRED` statuses.

## Broader Analytics (Future)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/analytics/dashboard` | Superseded in design by role dashboards (`/dashboard/admin`); may be revisited |

## Recommendations (Implemented)

### Get my recommendations

```http
GET /api/v1/recommendations/me?limit=6
```

Access: student only. `limit` defaults to 6 and must be between 1 and 20.
Returns active titles with an available copy that the student has not rated or borrowed. Ranking combines
similarity to the student's positively rated or borrowed books using already
indexed embeddings, category interests, issue counts, and average ratings. A
diversity step reduces near-duplicate suggestions. If embeddings or personal
signals are unavailable, category and library-wide signals provide a fallback;
the request does not generate embeddings. Each item contains a complete `book`
response and a short `reason` tied to the strongest available signal. The response can be empty when the student
has already rated or borrowed every active title.

Semantic book search is already implemented at `GET /api/v1/books/search` and
is documented above. The previously proposed `/api/v1/search/semantic` path is
not registered.

## Audit Logs (Implemented)

Administrators can review append-only events for books and digital PDFs, copies, authors, categories, publishers, languages, departments, user administration, circulation, reservation lifecycle changes, fines, and policy actions.

```http
GET /api/v1/audit-logs?page=1&page_size=20&action=BOOK_ISSUED&q=ACC-00001&start_date=2026-11-01&end_date=2026-11-09
```

Access: `Admin` only. Librarians and students receive `403 Forbidden`.

Query parameters:

| Parameter | Notes |
|-----------|-------|
| `page` | 1-based page, defaults to `1` |
| `page_size` | 1–100, defaults to `20` |
| `action` | `BOOK_CREATED`, `BOOK_UPDATED`, `BOOK_DELETED`, `DIGITAL_RESOURCE_UPLOADED`, `DIGITAL_RESOURCE_REMOVED`, `COPY_CREATED`, `COPY_UPDATED`, `AUTHOR_CREATED`, `AUTHOR_UPDATED`, `AUTHOR_DELETED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`, `PUBLISHER_CREATED`, `PUBLISHER_UPDATED`, `PUBLISHER_DELETED`, `LANGUAGE_CREATED`, `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`, `DEPARTMENT_DELETED`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_PASSWORD_RESET`, `BOOK_ISSUED`, `BOOK_RETURNED`, `BOOK_RENEWED`, `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_EXPIRED`, `RESERVATION_FULFILLED`, `FINE_RECORDED`, `FINE_PAID`, or `CIRCULATION_POLICY_UPDATED` |
| `q` | Search actor name/email, summary, entity type, or entity ID; max 200 characters |
| `start_date`, `end_date` | Inclusive UTC calendar dates; start must be on or before end |

Response: `200`, using the standard paginated response shape. Each item includes
the actor name/email snapshot, action, entity type and ID, a human-readable
summary, action-specific details, and `occurred_at`.

```json
{
  "items": [
    {
      "id": "8f337c21-49db-4af3-9e35-d61bc6b06cb0",
      "actor_user_id": "5b704954-8996-452d-a8a0-953f686ce330",
      "actor_name": "Dev Librarian",
      "actor_email": "librarian@library.local",
      "action": "BOOK_ISSUED",
      "entity_type": "TRANSACTION",
      "entity_id": "b4e1650e-ccdd-4f1d-bf67-4856ee82c826",
      "summary": "Issued \"Clean Code\" (copy ACC-00001) to Abhishek I",
      "details": {
        "book_title": "Clean Code",
        "inventory_code": "ACC-00001",
        "student_name": "Abhishek I",
        "student_code": "STU-001",
        "due_date": "2026-11-23",
        "reservation_fulfilled": false
      },
      "occurred_at": "2026-11-09T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

Events are created only for successful actions and share the action's database
transaction. User-change events never record password values or hashes. Actor
name/email snapshots are retained; the user foreign key is set to null if the
account is physically removed. No events are backfilled for activity before
the audit log migration, and no edit/delete API is exposed. Language currently
supports creation only, so its event history covers creation; edit/delete actions
are recorded for departments and authors, categories, and publishers where those
operations exist. Author/category/publisher/language relationships changed while
editing a book are included in that book's update event.

Reservation creation, cancellation, expiration, and fulfillment are recorded
against the reservation ID. Expiration is attributed to `System` with a null
user ID because it is processed automatically during reservation or circulation
requests. Fulfillment is recorded alongside the corresponding `BOOK_ISSUED`
event when staff issue a copy to the reservation holder.

## Library Calendar (Future)

| Method | Path |
|--------|------|
| GET | `/api/v1/library-calendar` |
| POST | `/api/v1/library-calendar` |

Will support working-day fine calculation (currently fines use **calendar days**).
