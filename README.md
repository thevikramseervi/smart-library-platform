# Smart Library Platform

An AI-Powered Cloud-Based Library Management System built as a final-year engineering project.

## Overview

Smart Library Platform is a modern Library Management System designed to manage physical books, digital resources, library circulation, reservations, fines, notifications, analytics, and AI-powered features.

The platform supports multiple user roles and provides an intuitive web-based interface for administrators, librarians, and students.

---

## Key Features

### Library Management

* Book Management
* Author Management
* Category Management
* Publisher Management
* Language Management
* Physical Book Inventory

### Circulation Management

* Book Issue
* Book Return
* Book Renewal
* Reservations
* Fine Management
* Working-Day Based Fine Calculation

### QR-Based Operations

* Student QR Codes
* Book Copy QR Codes
* QR-Based Issue Workflow
* QR-Based Return Workflow

### Digital Library

* Digital Resources
* PDF Viewer
* PDF Download
* Cloud Storage Integration

### Community Features

* Ratings
* Reviews

### Notifications

* Due Date Reminders
* Reservation Notifications
* Fine Notifications
* Activity Notifications

### Analytics

* Borrowing Trends
* Popular Books
* Department Usage Statistics
* Fine Collection Statistics

### AI Features

* Personalized Recommendations
* Semantic Search
* Vector Similarity Search
* Recommendation Evaluation Metrics

---

## User Roles

### Admin

* Manage Users
* Manage Departments
* Manage Library Catalog
* View Analytics
* View Audit Logs
* Configure System Settings

### Librarian

* Manage Books
* Manage Book Copies
* Issue Books
* Return Books
* Manage Reservations
* Manage Digital Resources

### Student

* Search Books
* Borrow Books
* Reserve Books
* View Digital Resources
* View Recommendations
* Rate Books
* Review Books

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* React Router
* Zustand
* TanStack Query
* Axios
* Recharts

### Backend

* Python
* FastAPI
* Uvicorn
* SQLAlchemy
* Alembic
* Psycopg
* Pydantic

### Database

* PostgreSQL
* pgvector
* Neon PostgreSQL

### Authentication

* JWT
* python-jose
* Passlib

### AI / Machine Learning

* NumPy
* Pandas
* scikit-learn
* Sentence Transformers

### Development Tools

* Cursor
* Git
* GitHub
* uv
* pnpm

### Deployment

* Frontend: Vercel
* Backend: Render
* Database: Neon PostgreSQL
* Object Storage: Cloudflare R2

---

## System Architecture

```text
React Frontend
        ↓
FastAPI Backend
        ↓
PostgreSQL + pgvector
        ↓
Neon Database

Digital Resources
        ↓
Cloudflare R2
```

---

## Repository Structure

```text
smart-library-platform/

├── frontend/
├── backend/
├── docs/

│   ├── architecture.md
│   ├── database.md
│   ├── api-spec.md
│   └── project-rules.md

├── README.md
└── .cursorrules
```

---

## Documentation

Project documentation is available in the `docs` directory.

* architecture.md
* database.md
* api-spec.md
* project-rules.md

These documents are considered the source of truth for the project.

---

## AI Components

### Recommendation Engine

Algorithms:

* Popularity-Based Filtering
* Content-Based Filtering
* Collaborative Filtering

Input Signals:

* Borrow History
* Ratings
* Department
* Semester

Evaluation Metrics:

* Precision@K
* Recall@K
* Hit Rate

### Semantic Search

Uses:

* Sentence Transformers
* pgvector
* Cosine Similarity

Allows natural language book discovery.

Example:

```text
beginner books for learning machine learning using python
```

---

## Development Principles

* Modular Architecture
* Layered Backend Design
* Role-Based Access Control
* Soft Deletes
* UUID Primary Keys
* API Versioning
* Type Safety
* Reusable Components
* Documentation-Driven Development

---

## License

Educational Project.

