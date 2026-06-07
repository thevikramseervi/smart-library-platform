# Smart Library Platform - Database Design

**Version:** Sprint 4.8

## Overview

The Smart Library Platform uses **PostgreSQL** managed by **Alembic migrations** in `backend/alembic/versions/`.

This document has two parts:

1. **[Implemented Schema](#implemented-schema)** — tables that exist in migrations today  
2. **[Planned Schema](#planned-schema-not-yet-implemented)** — future tables documented for design reference only  

Do not assume planned tables exist in the database until a migration adds them.

---

# Database Standards

## Primary Keys

All tables use UUID primary keys.

## Timestamps

Most entities contain:

```sql
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

## Soft Deletes

Major business entities use:

```sql
deleted_at TIMESTAMP WITH TIME ZONE NULL
```

Applied to: `users`, `books`, `authors`, `categories`, `publishers` (when deleted via API).

---

# Implemented Schema

Tables created by Alembic migrations `001` through `004`.

## Migration History

| Revision | Tables / changes |
|----------|------------------|
| `001_core_schema` | `roles`, `departments`, `users`; enables `pgcrypto` |
| `002_catalog_schema` | `publishers`, `languages`, `authors`, `categories`, `books`, `book_authors`, `book_categories`, `book_copies` |
| `003_circulation_schema` | `transactions`, `reservations`, `fines` |
| `004_book_copy_retired_status` | Adds `RETIRED` to `BookCopyStatus` enum |

---

## PostgreSQL ENUM Definitions (Implemented)

### UserRole (stored in `roles.name`)

```text
ADMIN
LIBRARIAN
STUDENT
```

### BookCopyStatus

```text
AVAILABLE
BORROWED
RESERVED
LOST
DAMAGED
RETIRED
```

`LOST`, `DAMAGED`, and `RETIRED` copies are excluded from `available_copies` and cannot be issued. Staff update copy status via `PUT /book-copies/{id}` when the copy is not on loan. `BORROWED` and `RESERVED` are managed by circulation workflows.

### TransactionStatus

```text
ISSUED
RETURNED
```

**Overdue is not stored.** A loan is overdue when `status = ISSUED` AND `due_at < current_date`. API responses include computed `is_overdue`.

> The enum value `OVERDUE` is **not used** in the current schema.

### ReservationStatus

```text
ACTIVE
FULFILLED
CANCELLED
EXPIRED
```

---

## roles

| Column     | Type        | Constraints     |
| ---------- | ----------- | --------------- |
| id         | UUID        | PK              |
| name       | VARCHAR(50) | UNIQUE NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL        |
| updated_at | TIMESTAMPTZ | NOT NULL        |

## departments

| Column      | Type         |
| ----------- | ------------ |
| id          | UUID         |
| name        | VARCHAR(100) |
| code        | VARCHAR(20)  |
| description | TEXT         |
| created_at  | TIMESTAMPTZ  |
| updated_at  | TIMESTAMPTZ  |

`code` is UNIQUE. Hard delete via API only when no active users reference the department.

## users

| Column        | Type         |
| ------------- | ------------ |
| id            | UUID         |
| role_id       | UUID         |
| department_id | UUID         |
| first_name    | VARCHAR(100) |
| last_name     | VARCHAR(100) |
| email         | VARCHAR(255) |
| phone         | VARCHAR(20)  |
| student_code  | VARCHAR(100) |
| password_hash | TEXT         |
| semester      | INTEGER      |
| is_active     | BOOLEAN      |
| created_at    | TIMESTAMPTZ  |
| updated_at    | TIMESTAMPTZ  |
| deleted_at    | TIMESTAMPTZ  |

Constraints: `email` UNIQUE, `student_code` UNIQUE.

Students require `semester` and `department_id`. Admins and librarians may have NULL `semester`.

## publishers, languages, authors, categories

Standard catalog reference tables with soft delete on publishers, authors, categories.

## books

Core bibliographic record with optional ISBN, publisher, language, edition, cover URL, `is_digital` flag (no digital resource storage yet).

## book_authors, book_categories

Many-to-many junction tables.

## book_copies

| Column         | Type           |
| -------------- | -------------- |
| id             | UUID           |
| book_id        | UUID           |
| inventory_code | VARCHAR(100)   |
| qr_code_value  | VARCHAR(100)   |
| location       | VARCHAR(100)   |
| status         | BookCopyStatus |
| acquired_date  | DATE           |
| created_at     | TIMESTAMPTZ    |
| updated_at     | TIMESTAMPTZ    |

`inventory_code` UNIQUE. `qr_code_value` defaults to `inventory_code` for future QR workflows.

## transactions

| Column       | Type              |
| ------------ | ----------------- |
| id           | UUID              |
| book_copy_id | UUID              |
| student_id   | UUID              |
| issued_by    | UUID              |
| issued_at    | TIMESTAMPTZ       |
| due_at       | DATE              |
| returned_at  | TIMESTAMPTZ       |
| status       | TransactionStatus |
| created_at   | TIMESTAMPTZ       |
| updated_at   | TIMESTAMPTZ       |

Partial unique index: one open loan per copy (`status = ISSUED`).

Business rules:

* Issue only when copy status is `AVAILABLE`
* Return sets transaction `RETURNED` and copy `AVAILABLE`
* `due_at` = issue date + `LOAN_PERIOD_DAYS` (default 14, env-configurable)
* Students with unpaid fines cannot borrow (HTTP 409)

## reservations

| Column           | Type              |
| ---------------- | ----------------- |
| id               | UUID              |
| student_id       | UUID              |
| book_id          | UUID              |
| reservation_date | TIMESTAMPTZ       |
| expiry_date      | TIMESTAMPTZ       |
| status           | ReservationStatus |
| created_at       | TIMESTAMPTZ       |
| updated_at       | TIMESTAMPTZ       |

Business rules:

* Allowed only when no `AVAILABLE` copies exist for the book
* FIFO queue by `reservation_date`; position computed at query time
* One active reservation per student per book

## fines

| Column         | Type          |
| -------------- | ------------- |
| id             | UUID          |
| transaction_id | UUID          |
| amount         | DECIMAL(10,2) |
| reason         | VARCHAR       |
| paid           | BOOLEAN       |
| paid_at        | TIMESTAMPTZ   |
| created_at     | TIMESTAMPTZ   |
| updated_at     | TIMESTAMPTZ   |

Business rules:

* Created on late return: `(return_date - due_at)` **calendar days** × `DAILY_OVERDUE_FINE_RATE` (default ₹10.00/day)
* One fine per transaction
* Unpaid fines block new issues

---

# Business Rules Summary

| Topic | Current behaviour | Future |
|-------|-------------------|--------|
| Overdue detection | Derived (`ISSUED` + past `due_at`) | — |
| Fine calculation | Calendar days late × daily rate | Working-day calculation via `library_calendar` (planned) |
| Reservation queue | FIFO by `reservation_date` | — |
| Copy QR | `qr_code_value` stored; no QR API yet | Sprint 5+ QR endpoints |
| Book renewal | Not implemented | Future sprint |

---

# Planned Schema (Not Yet Implemented)

The tables below are **design targets**. They do **not** exist in current migrations.

## digital_resources

PDF and file metadata with URLs pointing to Cloudflare R2 (not PostgreSQL blobs).

## ratings

One rating (1–5) per student per book.

## reviews

One review text per student per book.

## book_embeddings

Vector embeddings for semantic search (requires pgvector extension on PostgreSQL).

## notifications

In-app notification records per user.

## audit_logs

Administrative action audit trail.

## library_calendar

Holiday and closure dates for working-day fine calculation.

---

# AI Design Notes (Future)

When implemented, recommendations will use borrow history, ratings, department, and semester. Semantic search will use Sentence Transformers + pgvector cosine similarity over book metadata embeddings.

These features require planned tables and infrastructure not present in Sprint 4.

---

# PostgreSQL Deployment Notes

## Local development

Docker Compose (`docker-compose.yml`) uses `pgvector/pgvector:pg16`. Current migrations only require `pgcrypto`.

## Neon

Use connection string with `sslmode=require`. Run `uv run alembic upgrade head` from `backend/`.

Enable `pgvector` on Neon when semantic search is implemented.

---

# Related Documentation

- [`setup.md`](setup.md) — database setup
- [`api-spec.md`](api-spec.md) — REST API
- [`sprint-4-summary.md`](sprint-4-summary.md) — delivery history
