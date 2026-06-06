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
* Permission checks
* AI workflows

Must Not:

* Directly access database sessions

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

All primary keys must use UUID.

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
* python-jose

Password Storage:

* Passlib
* bcrypt

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

Mandatory Stack:

* Sentence Transformers
* pgvector

Similarity Metric:

* Cosine Similarity

---

## Not Allowed

Do Not Use:

* LangChain
* LlamaIndex
* Autonomous Agents

for version 1.

---

# QR Rules

Each Book Copy must have:

```text
inventory_code
```

QR code generated from inventory_code.

---

Each Student must have:

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

