# Smart Library Platform - API Specification

**Implementation snapshot:** 2026-11-09 (API prefix `/api/v1`)

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

Business rules:

* Blocked with 409 while any copy of the book is `AVAILABLE` or `BORROWED`.
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

Returns the caller's rating or `null`.

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

## Reviews (Future)

Ratings are **implemented** — see the [Ratings](#ratings) section. Reviews remain a design target:

| Method | Path |
|--------|------|
| POST | `/api/v1/books/{book_id}/reviews` |
| PUT | `/api/v1/books/{book_id}/reviews/{id}` |
| DELETE | `/api/v1/books/{book_id}/reviews/{id}` |

## Notifications (Sprint 5+)

| Method | Path |
|--------|------|
| GET | `/api/v1/notifications` |
| POST | `/api/v1/notifications/{id}/read` |

## Analytics (Future)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/analytics/dashboard` | Superseded in design by role dashboards (`/dashboard/admin`); may be revisited |

## Recommendations (Future)

| Method | Path |
|--------|------|
| GET | `/api/v1/recommendations/me` |

Semantic book search is already implemented at `GET /api/v1/books/search` and
is documented above. The previously proposed `/api/v1/search/semantic` path is
not registered.

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

