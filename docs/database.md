# Smart Library Platform - Database Design

**Version:** Sprint 5.1

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

Tables created by Alembic migrations `001` through `010`.

## Migration History

| Revision | Tables / changes |
|----------|------------------|
| `001_core_schema` | `roles`, `departments`, `users`; enables `pgcrypto` |
| `002_catalog_schema` | `publishers`, `languages`, `authors`, `categories`, `books`, `book_authors`, `book_categories`, `book_copies` |
| `003_circulation_schema` | `transactions`, `reservations`, `fines` |
| `004_book_copy_retired_status` | Adds `RETIRED` to `BookCopyStatus` enum |
| `005_enable_pgvector` | Enables PostgreSQL `vector` extension |
| `006_search_schema` | `book_embeddings`, `books.search_vector`, FTS/trigram/HNSW indexes; enables `pg_trgm` |
| `007_missing_fk_indexes` | Indexes `book_copies.book_id`, `reservations(student_id, status)`; UNIQUE index on `fines.transaction_id`; model metadata mirrors DB constraints |
| `008_transaction_reservation_link` | `transactions.reservation_id` FK + index (which queued reservation an issue fulfilled) |
| `009_user_token_version` | `users.token_version` for JWT session revocation on password reset/change |
| `010_transaction_returned_by` | `transactions.returned_by` FK recording which staff member processed a return |
| `011_embedding_384_dims` | Resizes `book_embeddings.embedding` to `vector(384)` for FastEmbed's bge-small-en-v1.5; invalidates prior-model vectors |
| `012_ratings` | `ratings`: one 1-5 score per student per book (UNIQUE + CHECK constraints, ON DELETE CASCADE) |

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

### EmbeddingStatus

```text
PENDING
INDEXED
FAILED
```

Used by `book_embeddings.embedding_status`. Only rows with `INDEXED` and a non-null embedding participate in semantic search.

Indexing runs offline via the reindex command (`uv run python -m app.scripts.reindex_embeddings`) using FastEmbed with `BAAI/bge-small-en-v1.5`. Catalog writes mark their row `PENDING`; a stored content-hash mismatch flags edited books as stale.

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
| token_version | INTEGER      |
| created_at    | TIMESTAMPTZ  |
| updated_at    | TIMESTAMPTZ  |
| deleted_at    | TIMESTAMPTZ  |

Constraints: `email` UNIQUE, `student_code` UNIQUE. Default `token_version = 0`.

Students require `semester` and `department_id`. Admins and librarians may have NULL `semester`.

JWTs carry the `token_version` value at issue time; resetting or changing a password increments the column, invalidating all previously issued tokens for that user.

## publishers, languages, authors, categories

Standard catalog reference tables with soft delete on publishers, authors, categories.

## books

Core bibliographic record with optional ISBN, publisher, language, edition, cover URL, `is_digital` flag (no digital resource storage yet).

| Column | Type | Notes |
| ------ | ---- | ----- |
| search_vector | TSVECTOR | Nullable; populated by indexing pipeline (Sprint 5.2+) |

GIN index `ix_books_search_vector` (partial: `deleted_at IS NULL`). Trigram index `ix_books_title_trgm` for autocomplete.

## book_embeddings

1:1 semantic search metadata per book. Canonical embed text is rebuilt from catalog metadata at index time (not stored).

| Column | Type | Notes |
| ------ | ---- | ----- |
| book_id | UUID | PK, FK → `books.id` ON DELETE CASCADE |
| embedding | vector(384) | NULL while `PENDING`, `FAILED`, or not yet indexed |
| embedding_status | EmbeddingStatus | Default `PENDING` |
| content_hash | CHAR(64) | SHA-256 of canonical text |
| model_name | VARCHAR(100) | Set on successful index |
| model_version | VARCHAR(50) | Model pin for migration |
| last_error | TEXT | Populated when `FAILED` |
| indexed_at | TIMESTAMPTZ | Set when status → `INDEXED` |
| created_at / updated_at | TIMESTAMPTZ | Standard |

Indexes: HNSW on `embedding` (`vector_cosine_ops`), partial btree `ix_book_embeddings_indexed` for indexed rows.

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

| Column         | Type              |
| -------------- | ----------------- |
| id             | UUID              |
| book_copy_id   | UUID              |
| student_id     | UUID              |
| issued_by      | UUID              |
| returned_by    | UUID (nullable)   |
| reservation_id | UUID (nullable)   |
| issued_at      | TIMESTAMPTZ       |
| due_at         | DATE              |
| returned_at    | TIMESTAMPTZ       |
| status         | TransactionStatus |
| created_at     | TIMESTAMPTZ       |
| updated_at     | TIMESTAMPTZ       |

Indexes: `(student_id, status)`, `status`, `due_at`, `reservation_id`; partial unique index enforcing one open loan per copy (`status = ISSUED`).

Business rules:

* Issue only when copy status is `AVAILABLE` (or `RESERVED` for the head of the book's queue)
* Return sets transaction `RETURNED` and copy `AVAILABLE`, or copy `RESERVED` when an active queue remains
* `due_at` = issue date + `LOAN_PERIOD_DAYS` (default 14, env-configurable)
* Students with unpaid fines cannot borrow (HTTP 409)
* Students cannot exceed `MAX_ACTIVE_LOANS` concurrent loans (default 5)
* Issue/return serialize on row locks: the student and copy rows are locked `FOR UPDATE` before status checks

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

Indexes: `(book_id, status, reservation_date)`, `(student_id, status)`; partial UNIQUE `(student_id, book_id) WHERE status = 'ACTIVE'`.

Business rules:

* Allowed only when no `AVAILABLE` copies exist for the book
* FIFO queue by `reservation_date`; position computed at query time
* One active reservation per student per book (DB-enforced by the partial unique index)
* Cancelling or expiring the last active reservation releases copies held as `RESERVED` back to `AVAILABLE`

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

Constraints: `transaction_id` UNIQUE (enforced since migration `007`).

Business rules:

* Created on late return: `(return_date - due_at)` **calendar days** × `DAILY_OVERDUE_FINE_RATE` (default ₹10.00/day), clamped to `MAX_FINE_AMOUNT` (default ₹500.00)
* One fine per transaction
* Unpaid fines block new issues
* Payment is exactly-once: a conditional update on `paid = false` makes concurrent double-pays return 409

---

# Business Rules Summary

| Topic | Current behaviour | Future |
|-------|-------------------|--------|
| Overdue detection | Derived (`ISSUED` + past `due_at`, UTC calendar) | — |
| Fine calculation | Calendar days late × daily rate, clamped to `MAX_FINE_AMOUNT` | Working-day calculation via `library_calendar` (planned) |
| Loan limit | Max `MAX_ACTIVE_LOANS` (default 5) concurrent loans per student | — |
| Reservation queue | FIFO by `reservation_date`; returns hold copies `RESERVED` for queue head; issues honor queue unless `bypass_reservation` | — |
| Session revocation | Password reset/change bumps `users.token_version`; old JWTs rejected immediately | Token refresh endpoint (planned) |
| Copy QR | `qr_code_value` stored; no QR API yet | Sprint 5+ QR endpoints |
| Book renewal | Not implemented | Future sprint |

---

# Planned Schema (Not Yet Implemented)

The tables below are **design targets**. They do **not** exist in current migrations.

## digital_resources

PDF and file metadata with URLs pointing to Cloudflare R2 (not PostgreSQL blobs).

## ratings

One rating (1–5) per student per book — **implemented** in migration `012`.

| Column     | Type         |
| ---------- | ------------ |
| id         | UUID         |
| book_id    | UUID (FK → books, CASCADE) |
| student_id | UUID (FK → users, CASCADE) |
| score      | INTEGER (CHECK 1–5) |
| created_at / updated_at | TIMESTAMPTZ |

Constraints: UNIQUE `(book_id, student_id)`. Indexes on both FK columns.

## reviews

One review text per student per book.

## notifications

In-app notification records per user.

## audit_logs

Administrative action audit trail.

## library_calendar

Holiday and closure dates for working-day fine calculation.

---

# AI Design Notes (Future)

Recommendations (future) will use borrow history, ratings, department, and semester. Semantic search is live: FastEmbed `BAAI/bge-small-en-v1.5` embeddings (384-dim) stored in `book_embeddings` with pgvector cosine similarity over an HNSW index. Search analytics (`search_query_logs`) remains planned for Sprint 5.5.

---

# PostgreSQL Deployment Notes

## Local development

Docker Compose (`docker-compose.yml`) uses `pgvector/pgvector:pg16`. Migrations enable `pgcrypto`, `vector`, and `pg_trgm` as required.

## Neon

Use connection string with `sslmode=require`. Run `uv run alembic upgrade head` from `backend/`.

Enable `vector` and `pg_trgm` extensions via migrations `005` and `006` (supported on Neon PostgreSQL 16).

---

# Related Documentation

- [`setup.md`](setup.md) — database setup
- [`api-spec.md`](api-spec.md) — REST API
- [`sprint-4-summary.md`](sprint-4-summary.md) — delivery history
