# Smart Library Platform - Database Design (v1.0)

## Overview

The Smart Library Platform uses PostgreSQL as the primary database and follows a normalized relational schema.

The design supports:

* Role-based access control
* Physical book inventory management
* Digital resource management
* QR-based circulation
* Reservations
* Fine management
* Ratings and reviews
* Notifications
* Audit logging
* AI-powered recommendations
* Semantic search using vector embeddings

---

# Database Standards

## Primary Keys

All tables use UUID primary keys.

Example:

```sql
id UUID PRIMARY KEY
```

---

## Timestamps

Most entities contain:

```sql
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

---

## Soft Deletes

Major business entities use:

```sql
deleted_at TIMESTAMP WITH TIME ZONE NULL
```

Records should be soft deleted instead of permanently removed.

Used for:

* users
* books
* authors
* categories
* publishers
* digital_resources

---

# PostgreSQL ENUM Definitions

## UserRole

```text
ADMIN
LIBRARIAN
STUDENT
```

---

## BookCopyStatus

```text
AVAILABLE
BORROWED
RESERVED
LOST
DAMAGED
```

---

## TransactionStatus

```text
ISSUED
RETURNED
OVERDUE
```

---

## ReservationStatus

```text
ACTIVE
FULFILLED
CANCELLED
EXPIRED
```

---

# Roles

## roles

| Column     | Type        | Constraints     |
| ---------- | ----------- | --------------- |
| id         | UUID        | PK              |
| name       | VARCHAR(50) | UNIQUE NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL        |
| updated_at | TIMESTAMPTZ | NOT NULL        |

Relationship:

```text
Role (1) → Users (N)
```

---

# Departments

## departments

| Column      | Type         |
| ----------- | ------------ |
| id          | UUID         |
| name        | VARCHAR(100) |
| code        | VARCHAR(20)  |
| description | TEXT         |
| created_at  | TIMESTAMPTZ  |
| updated_at  | TIMESTAMPTZ  |

Constraints:

```text
code UNIQUE
```

Relationship:

```text
Department (1) → Users (N)
```

---

# Users

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

Constraints:

```text
email UNIQUE
student_code UNIQUE
```

Notes:

* Admins may have NULL semester.
* Librarians may have NULL semester.
* Students must have semester.

Relationships:

```text
User (N) → Role (1)

User (N) → Department (1)
```

---

# Publishers

## publishers

| Column     | Type         |
| ---------- | ------------ |
| id         | UUID         |
| name       | VARCHAR(255) |
| website    | VARCHAR(255) |
| country    | VARCHAR(100) |
| created_at | TIMESTAMPTZ  |
| updated_at | TIMESTAMPTZ  |
| deleted_at | TIMESTAMPTZ  |

Constraint:

```text
name UNIQUE
```

Relationship:

```text
Publisher (1) → Books (N)
```

---

# Languages

## languages

| Column     | Type         |
| ---------- | ------------ |
| id         | UUID         |
| name       | VARCHAR(100) |
| code       | VARCHAR(20)  |
| created_at | TIMESTAMPTZ  |
| updated_at | TIMESTAMPTZ  |

Constraints:

```text
name UNIQUE
code UNIQUE
```

Relationship:

```text
Language (1) → Books (N)
```

---

# Authors

## authors

| Column     | Type         |
| ---------- | ------------ |
| id         | UUID         |
| name       | VARCHAR(255) |
| bio        | TEXT         |
| created_at | TIMESTAMPTZ  |
| updated_at | TIMESTAMPTZ  |
| deleted_at | TIMESTAMPTZ  |

Relationship:

```text
Author (M) ↔ Books (M)
```

---

# Categories

## categories

| Column      | Type         |
| ----------- | ------------ |
| id          | UUID         |
| name        | VARCHAR(255) |
| description | TEXT         |
| created_at  | TIMESTAMPTZ  |
| updated_at  | TIMESTAMPTZ  |
| deleted_at  | TIMESTAMPTZ  |

Constraint:

```text
name UNIQUE
```

Relationship:

```text
Category (M) ↔ Books (M)
```

---

# Books

## books

| Column           | Type         |
| ---------------- | ------------ |
| id               | UUID         |
| title            | VARCHAR(500) |
| isbn             | VARCHAR(50)  |
| publisher_id     | UUID         |
| language_id      | UUID         |
| edition          | VARCHAR(50)  |
| publication_year | INTEGER      |
| description      | TEXT         |
| cover_image_url  | TEXT         |
| is_digital       | BOOLEAN      |
| created_at       | TIMESTAMPTZ  |
| updated_at       | TIMESTAMPTZ  |
| deleted_at       | TIMESTAMPTZ  |

Notes:

* ISBN is optional.
* Books without ISBN are allowed.

Indexes:

```text
title
isbn
publication_year
```

Relationships:

```text
Book (N) → Publisher (1)

Book (N) → Language (1)
```

---

# Book Authors

## book_authors

| Column    | Type |
| --------- | ---- |
| book_id   | UUID |
| author_id | UUID |

Primary Key:

```text
(book_id, author_id)
```

Relationship:

```text
Book (M) ↔ Author (M)
```

---

# Book Categories

## book_categories

| Column      | Type |
| ----------- | ---- |
| book_id     | UUID |
| category_id | UUID |

Primary Key:

```text
(book_id, category_id)
```

Relationship:

```text
Book (M) ↔ Category (M)
```

---

# Book Copies

## book_copies

| Column         | Type           |
| -------------- | -------------- |
| id             | UUID           |
| book_id        | UUID           |
| inventory_code | VARCHAR(100)   |
| location       | VARCHAR(100)   |
| status         | BookCopyStatus |
| acquired_date  | DATE           |
| created_at     | TIMESTAMPTZ    |
| updated_at     | TIMESTAMPTZ    |

Constraints:

```text
inventory_code UNIQUE
```

Notes:

* QR codes are generated using inventory_code.
* Each physical copy has a unique inventory code.

Relationship:

```text
Book (1) → BookCopies (N)
```

---

# Digital Resources

## digital_resources

| Column      | Type         |
| ----------- | ------------ |
| id          | UUID         |
| book_id     | UUID         |
| file_url    | TEXT         |
| file_name   | VARCHAR(255) |
| file_type   | VARCHAR(50)  |
| file_size   | BIGINT       |
| uploaded_by | UUID         |
| created_at  | TIMESTAMPTZ  |
| updated_at  | TIMESTAMPTZ  |
| deleted_at  | TIMESTAMPTZ  |

Notes:

Multiple resources may belong to a single book.

Examples:

```text
PDF

Solution Manual

Lab Guide

Supplementary Material
```

Relationship:

```text
Book (1) → DigitalResources (N)
```

---

# Transactions

## transactions

| Column       | Type              |
| ------------ | ----------------- |
| id           | UUID              |
| book_copy_id | UUID              |
| student_id   | UUID              |
| issued_by    | UUID              |
| issue_date   | DATE              |
| due_date     | DATE              |
| return_date  | DATE              |
| status       | TransactionStatus |
| created_at   | TIMESTAMPTZ       |
| updated_at   | TIMESTAMPTZ       |

Relationships:

```text
BookCopy (1) → Transactions (N)

Student (1) → Transactions (N)

Librarian (1) → Transactions (N)
```

Business Rules:

* A book copy can only be issued if status = AVAILABLE.
* Returning a book updates BookCopy status.
* Due dates are determined by library policy.

---

# Reservations

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

Business Rules:

* Reservation queue follows FIFO.
* Oldest active reservation gets priority.

Relationships:

```text
Student (1) → Reservations (N)

Book (1) → Reservations (N)
```

---

# Fines

## fines

| Column         | Type          |
| -------------- | ------------- |
| id             | UUID          |
| transaction_id | UUID          |
| amount         | DECIMAL(10,2) |
| paid           | BOOLEAN       |
| paid_at        | TIMESTAMPTZ   |
| created_at     | TIMESTAMPTZ   |
| updated_at     | TIMESTAMPTZ   |

Business Rules:

* Fine calculated using working days.
* Library closures are excluded.
* Fine linked to exactly one transaction.

Relationship:

```text
Transaction (1) → Fine (0..1)
```

---

# Ratings

## ratings

| Column     | Type        |
| ---------- | ----------- |
| id         | UUID        |
| student_id | UUID        |
| book_id    | UUID        |
| rating     | SMALLINT    |
| created_at | TIMESTAMPTZ |

Constraint:

```text
rating BETWEEN 1 AND 5
```

Business Rule:

One rating per student per book.

---

# Reviews

## reviews

| Column      | Type        |
| ----------- | ----------- |
| id          | UUID        |
| student_id  | UUID        |
| book_id     | UUID        |
| review_text | TEXT        |
| created_at  | TIMESTAMPTZ |
| updated_at  | TIMESTAMPTZ |

Business Rule:

One review per student per book.

---

# Book Embeddings

## book_embeddings

| Column     | Type         |
| ---------- | ------------ |
| book_id    | UUID         |
| embedding  | VECTOR       |
| model_name | VARCHAR(255) |
| updated_at | TIMESTAMPTZ  |

Relationship:

```text
Book (1) → BookEmbedding (1)
```

Used For:

```text
Semantic Search

Similarity Search

Recommendation Features
```

---

# Notifications

## notifications

| Column     | Type         |
| ---------- | ------------ |
| id         | UUID         |
| user_id    | UUID         |
| title      | VARCHAR(255) |
| message    | TEXT         |
| is_read    | BOOLEAN      |
| created_at | TIMESTAMPTZ  |

Examples:

```text
Reservation Available

Book Due Tomorrow

Fine Generated

Book Returned Successfully
```

---

# Audit Logs

## audit_logs

| Column      | Type         |
| ----------- | ------------ |
| id          | UUID         |
| user_id     | UUID         |
| action      | VARCHAR(255) |
| entity_type | VARCHAR(100) |
| entity_id   | UUID         |
| created_at  | TIMESTAMPTZ  |

Examples:

```text
BOOK_CREATED

BOOK_UPDATED

BOOK_DELETED

BOOK_ISSUED

BOOK_RETURNED

USER_CREATED
```

---

# Library Calendar

## library_calendar

| Column     | Type         |
| ---------- | ------------ |
| date       | DATE         |
| is_open    | BOOLEAN      |
| reason     | VARCHAR(255) |
| created_at | TIMESTAMPTZ  |

Primary Key:

```text
date
```

Used For:

```text
Fine Calculation

Holiday Management

Working Day Calculations
```

Examples:

```text
Republic Day

Independence Day

Library Maintenance

Festival Holiday
```

---

# AI Design Notes

## Recommendation Engine

Input Signals:

```text
Borrow History

Ratings

Department

Semester
```

Algorithms:

```text
Popularity-Based

Content-Based

Collaborative Filtering
```

---

## Semantic Search

Embedding Source:

```text
Book Title

Description

Author Names

Category Names
```

Storage:

```text
PostgreSQL + pgvector
```

Similarity:

```text
Cosine Similarity
```

---

# Future Extensions

Potential future additions:

```text
Faculty Role

Payment Gateway

RFID Support

Multi-Branch Libraries

Inter-Library Loans

Advanced Analytics
```

These features are intentionally excluded from version 1.0.

