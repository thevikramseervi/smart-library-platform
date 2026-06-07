# Smart Library Platform - API Specification (v1.0)

## Overview

The backend exposes REST APIs using FastAPI.

Authentication is JWT-based.

Authorization uses Role-Based Access Control (RBAC).

Roles:

* ADMIN
* LIBRARIAN
* STUDENT

Base URL:

```text
/api/v1
```

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

---

## Refresh Token

```http
POST /api/v1/auth/refresh
```

Access:

```text
Authenticated Users
```

---

## Logout

```http
POST /api/v1/auth/logout
```

Access:

```text
Authenticated Users
```

---

# User Management

## List Users

```http
GET /api/v1/users
```

Access:

```text
Admin
```

---

## Get User

```http
GET /api/v1/users/{id}
```

Access:

```text
Admin
```

---

## Create User

```http
POST /api/v1/users
```

Access:

```text
Admin
```

---

## Update User

```http
PUT /api/v1/users/{id}
```

Access:

```text
Admin
```

---

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
Soft Delete
```

---

# Departments

## List Departments

```http
GET /api/v1/departments
```

---

## Create Department

```http
POST /api/v1/departments
```

Access:

```text
Admin
```

---

## Update Department

```http
PUT /api/v1/departments/{id}
```

Access:

```text
Admin
```

---

## Delete Department

```http
DELETE /api/v1/departments/{id}
```

Access:

```text
Admin
```

---

# Publishers

## List Publishers

```http
GET /api/v1/publishers
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

---

## Generate QR

```http
GET /api/v1/book-copies/{id}/qr
```

Purpose:

```text
Generate QR code for book copy.
```

---

# Digital Resources

## Upload Resource

```http
POST /api/v1/digital-resources
```

Access:

```text
Admin, Librarian
```

---

## List Resources

```http
GET /api/v1/digital-resources
```

---

## Download Resource

```http
GET /api/v1/digital-resources/{id}
```

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

# Ratings

## Rate Book

```http
POST /api/v1/ratings
```

Access:

```text
Student
```

---

## Update Rating

```http
PUT /api/v1/ratings/{id}
```

---

# Reviews

## Create Review

```http
POST /api/v1/reviews
```

---

## Update Review

```http
PUT /api/v1/reviews/{id}
```

---

## Delete Review

```http
DELETE /api/v1/reviews/{id}
```

---

# Notifications

## My Notifications

```http
GET /api/v1/notifications
```

---

## Mark Read

```http
POST /api/v1/notifications/{id}/read
```

---

# Analytics

## Dashboard Analytics

```http
GET /api/v1/analytics/dashboard
```

Access:

```text
Admin
```

Metrics:

```text
Books Borrowed

Popular Categories

Top Readers

Fine Collection

Department Usage
```

---

# AI APIs

## Recommendations

```http
GET /api/v1/recommendations/me
```

Access:

```text
Student
```

Returns:

```text
Personalized recommendations.
```

---

## Semantic Search

```http
GET /api/v1/search/semantic
```

Query:

```text
?q=machine learning books for beginners
```

Returns:

```text
Similarity-ranked books.
```

---

# Audit Logs

## List Audit Logs

```http
GET /api/v1/audit-logs
```

Access:

```text
Admin
```

---

# Library Calendar

## List Calendar Entries

```http
GET /api/v1/library-calendar
```

---

## Create Calendar Entry

```http
POST /api/v1/library-calendar
```

Access:

```text
Admin
```

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

