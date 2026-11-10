# Smart Library Platform - Project Rules

## Purpose

This document defines the engineering standards, architectural constraints, coding conventions, and development rules for the Smart Library Platform.

All contributors and AI coding assistants must follow these rules.

---

# Technology Stack

## Frontend

Mandatory:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* React Router
* Zustand
* TanStack Query
* Axios

Do Not Use:

* Next.js
* Redux
* JavaScript
* jQuery

---

## Backend

Mandatory:

* Python
* FastAPI
* SQLAlchemy
* Alembic
* Psycopg
* Pydantic

Use Python logging.

Do not use print() for application logs.

Do Not Use:

* Django
* Flask
* Raw SQL except when absolutely necessary

---

## Database

Mandatory:

* PostgreSQL
* pgvector
* UUID primary keys

Do Not Use:

* MongoDB
* Firestore
* SQLite in production

---

# Package Management

## Python

Mandatory:

* uv

Use uv for:

* Virtual environments
* Dependency installation
* Dependency locking
* Running Python commands

Examples:

```bash
uv venv
uv sync
uv add fastapi
uv run uvicorn app.main:app --reload
```

Do Not Use:

* pip
* pipenv
* poetry

unless there is a specific technical requirement.

---

## JavaScript / TypeScript

Mandatory:

* pnpm

Use pnpm for:

* Dependency installation
* Dependency locking
* Script execution

Examples:

```bash
pnpm install
pnpm dev
pnpm build
```

Do Not Use:

* npm
* yarn
* bun

unless there is a specific technical requirement.

---

## Lock Files

Backend:

```text
uv.lock
```

Frontend:

```text
pnpm-lock.yaml
```

These files must always be committed to version control.


---

# Architecture Rules

The backend must follow layered architecture.

```text
API Layer
    ↓
Service Layer
    ↓
Repository Layer
    ↓
Database Layer
```

---

## API Layer

Responsibilities:

* Request validation
* Response formatting
* Authentication checks

Must Not:

* Contain business logic
* Contain database queries

---

## Service Layer

Responsibilities:

* Business logic
* Validation rules
* AI workflows
* Transaction orchestration and commit/rollback boundaries

The current services receive a SQLAlchemy `Session` and use repositories for
queries and persistence. Keep SQL statements in repositories; services may
coordinate repository calls and own the unit-of-work commit boundary. API
dependencies enforce route-level authentication and role access.

---

## Repository Layer

Responsibilities:

* Database queries
* Persistence operations

Must Not:

* Contain business logic

---

# Database Rules

## UUIDs

Entity-table primary keys should use UUID. Many-to-many junction tables may
use a composite primary key made from their foreign keys, as the current
`book_authors` and `book_categories` tables do.

Example:

```text
id UUID PRIMARY KEY
```

---

## Soft Deletes

Never permanently delete:

* users
* books
* authors
* categories
* publishers

Use:

```text
deleted_at
```

instead.

---

## Migrations

All schema changes must use Alembic migrations.

Never manually modify production tables.

---

# Authentication Rules

Authentication:

* JWT
* PyJWT (HS256; `sub`, `ver`, `iat`, `exp` required at decode)

Password Storage:

* bcrypt directly (cost 12)

Session Revocation:

* Logout stores the current token's digest until expiry, revoking that session
* `users.token_version` is embedded in tokens; password resets and changes bump it, invalidating old JWTs

Login Abuse Prevention:

* Failed logins rate limited per account and per IP (`LOGIN_RATE_LIMIT_*` settings)

Never:

* Store plain text passwords
* Store passwords in frontend code

---

# Authorization Rules

Supported Roles:

* Admin
* Librarian
* Student

Role checks must occur:

* API Layer
* Service Layer

Never trust frontend permissions.

---

# Frontend Rules

## TypeScript

All frontend code must use TypeScript.

No JavaScript files.

---

## Components

Prefer reusable components.

Avoid duplicated UI code.

---

## State Management

Use:

* Zustand

Do Not Use:

* Redux

---

## Data Fetching

Use:

* Axios
* TanStack Query

Do Not use direct fetch calls unless necessary.

---

# Backend Rules

## Type Hints

All Python functions must include type hints.

Example:

```python
def get_book(book_id: UUID) -> Book:
```

---

## Docstrings

Public functions should contain docstrings.

---

## Validation

All API requests must use Pydantic schemas.

Never accept raw request payloads.

---

# API Design Rules

## Versioning

All APIs must be versioned.

Example:

```text
/api/v1/books
```

---

## Naming

Use plural resource names.

Examples:

```text
/books
/users
/categories
```

Avoid:

```text
/book
/user
```

---

## Status Codes

Use proper HTTP status codes.

Examples:

```text
200 OK

201 Created

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

500 Internal Server Error
```

---

# Environment Strategy

## Backend
.env

.env.example

Example:

DATABASE_URL=

JWT_SECRET_KEY=

JWT_ALGORITHM=

ACCESS_TOKEN_EXPIRE_MINUTES=

CLOUD_STORAGE_BUCKET=

CLOUD_STORAGE_KEY=

CLOUD_STORAGE_SECRET=

CLOUD_STORAGE_ENDPOINT=

---

## Frontend
VITE_API_BASE_URL=

---

# API Response Rules

- Return Pydantic models directly.
- Use standard FastAPI response patterns.
- Do not wrap responses in success/data/message envelopes.
- Use proper HTTP status codes.
- Use structured responses for paginated endpoints.

---

# AI Rules

## Recommendation Engine

Allowed Algorithms:

* Popularity-Based
* Content-Based
* Collaborative Filtering

---

## Semantic Search

Implemented stack:

* FastEmbed ONNX (`BAAI/bge-small-en-v1.5`, 384 dimensions)
* PostgreSQL pgvector

Similarity Metric:

* Cosine similarity

The current reindex command is `uv run python -m app.scripts.reindex_embeddings`.
The implemented `/recommendations/me` endpoint reuses indexed embeddings to
compare available unseen titles with positively rated, borrowed, or liked books,
blended with category interest, popularity, and average ratings. Candidate pools
rotate across ratings, likes, borrowing, popularity, and highly rated titles.
Missing vectors fall
back to the existing catalog signals; requests must not perform model inference.
Keep results explainable and add diversity to avoid repetitive suggestions. Do
not add an external model, LangChain, LlamaIndex, or autonomous agents for this
feature.

---

## Not Allowed

Do Not Use:

* LangChain
* LlamaIndex
* Autonomous Agents

for version 1.

---

# QR Rules (Implemented Workflows)

Each copy stores `qr_code_value`, currently equal to its inventory code. The
frontend generates printable copy labels locally; staff can scan them on the
issue and return pages. On issue, an eligible scanned copy is selected; on
return, the code filters the active-loan search. These scans do not bypass
circulation eligibility or confirmation.

Each Book Copy must have:

```text
inventory_code
```

QR code generated from inventory_code.

---

Students with an assigned `student_code` have a library-card QR generated
locally in the profile. Staff can also view/print it from user management and
scan it on the issue page to find and select the student. The scan still
requires staff review and normal issue confirmation. It does not issue a book
without staff action, and there is no QR image API endpoint.

For a student QR, the encoded value is:

```text
student_code
```

QR code generated from student_code.

---

# Git Rules

Branch Strategy:

```text
main
develop
feature/*
```

---

Commit Messages:

Examples:

```text
feat: add authentication module

fix: correct fine calculation

refactor: move logic to service layer

docs: update api specification
```

---

# Testing Rules

Backend:

* pytest

Frontend:

* component testing when needed

Critical features must be tested:

* authentication
* issue book
* return book
* reservations
* fine calculation

---

# Documentation Rules

Any architectural change must update:

* architecture.md
* database.md
* api-spec.md

before implementation.

Documentation is the source of truth.

---

# Final Principle

When multiple solutions are possible:

Choose the solution that is:

1. More maintainable
2. More scalable
3. More professional
4. More consistent with existing architecture

Avoid choosing a solution solely because it is easier or faster.

