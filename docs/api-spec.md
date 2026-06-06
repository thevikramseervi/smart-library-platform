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
Librarian
```

Input:

```text
Student QR

Book QR
```

---

## Return Book

```http
POST /api/v1/transactions/return
```

Access:

```text
Librarian
```

---

## Renew Book

```http
POST /api/v1/transactions/renew
```

Access:

```text
Librarian
```

---

## Transaction History

```http
GET /api/v1/transactions
```

---

## Student History

```http
GET /api/v1/transactions/student/{id}
```

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

---

## Cancel Reservation

```http
DELETE /api/v1/reservations/{id}
```

---

## My Reservations

```http
GET /api/v1/reservations/me
```

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
Librarian
```

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

