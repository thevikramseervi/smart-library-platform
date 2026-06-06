# Smart Library Platform - Architecture Document

## 1. Project Overview

Smart Library Platform is an AI-powered, cloud-based Library Management System developed as a final-year engineering project.

The system manages physical books, digital resources, library circulation, reservations, fines, notifications, analytics, and AI-powered features such as semantic search and personalized recommendations.

The platform supports multiple user roles and is designed using modern web technologies and industry-standard software architecture principles.

---

## 2. Objectives

### Core Objectives

* Manage library books and inventory.
* Manage students, librarians, and administrators.
* Support issue, return, renewal, and reservation workflows.
* Manage fines and borrowing history.
* Support digital books and cloud-based storage.

### Advanced Objectives

* QR-based issue and return process.
* AI-powered recommendation system.
* Semantic search using vector embeddings.
* Analytics and reporting dashboard.
* Notification system.

---

## 3. User Roles

### Admin

Responsibilities:

* Manage librarians.
* Manage students.
* Manage books and categories.
* Manage departments.
* View analytics and reports.
* View audit logs.
* Configure system settings.

### Librarian

Responsibilities:

* Add and manage books.
* Manage book copies.
* Issue books.
* Accept returns.
* Manage reservations.
* Manage fines.
* Upload digital resources.

### Student

Responsibilities:

* Search books.
* Borrow books.
* Reserve books.
* View digital resources.
* View borrowing history.
* View fines.
* Rate and review books.
* Receive recommendations.

---

## 4. System Architecture

The system follows a modern three-tier architecture.

```text
Frontend
    ↓
Backend API
    ↓
Database
```

### Frontend Layer

Responsible for:

* User Interface
* Dashboards
* Forms
* QR Scanning
* Data Visualization
* Authentication UI

### Backend Layer

Responsible for:

* Business Logic
* Authentication
* Authorization
* Recommendation Engine
* Semantic Search
* Notification Processing

### Database Layer

Responsible for:

* Persistent Data Storage
* Transaction Management
* Vector Storage
* Analytics Data

---

## 5. Technology Stack

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
* Pydantic
* SQLAlchemy
* Alembic
* Psycopg

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

* Git
* GitHub
* Cursor
* uv
* pnpm

---

## 6. Frontend Architecture

The frontend follows a modular architecture.

```text
pages/
components/
layouts/
routes/
services/
hooks/
store/
types/
utils/
```

### State Management

* Zustand

### API Communication

* Axios
* TanStack Query

### Routing

* React Router

---

## 7. Backend Architecture

The backend follows a layered architecture.

```text
API Layer
    ↓
Service Layer
    ↓
Repository Layer
    ↓
Database Layer
```

### API Layer

Handles HTTP requests and responses.

### Service Layer

Contains business logic.

### Repository Layer

Handles database interactions.

### Database Layer

Handles persistence using PostgreSQL.

---

## 8. Authentication & Authorization

Authentication is implemented using JWT tokens.

Workflow:

```text
Login
    ↓
Password Verification
    ↓
JWT Generation
    ↓
Authenticated Requests
```

Role-Based Access Control (RBAC) is used.

Roles:

* Admin
* Librarian
* Student

---

## 9. AI Architecture

### Recommendation Engine

Algorithms:

* Popularity-Based Recommendation
* Content-Based Recommendation
* Collaborative Filtering

Input Signals:

* Borrow History
* Ratings
* Department
* Semester

### Semantic Search

Pipeline:

```text
Book Metadata
    ↓
Sentence Transformer
    ↓
Vector Embedding
    ↓
pgvector Storage
    ↓
Similarity Search
```

---

## 10. QR-Based Circulation

Each student and physical book copy receives a unique QR code.

Issue Process:

```text
Scan Student QR
    ↓
Scan Book QR
    ↓
Issue Book
```

Return Process:

```text
Scan Book QR
    ↓
Return Book
    ↓
Fine Calculation
```

---

## 11. Digital Library Architecture

Digital resources are stored in cloud storage.

The database stores metadata and file URLs.

```text
Cloud Storage
      ↓
File URL
      ↓
PostgreSQL
```

Students can:

* View PDFs in browser.
* Download PDFs.

---

## 12. Deployment Architecture

```text
React Frontend
       ↓
Vercel

FastAPI Backend
       ↓
Render

PostgreSQL + pgvector
       ↓
Neon
```

Digital resources are stored using cloud object storage.

---

## 13. Non-Functional Requirements

### Security

* Password hashing
* JWT authentication
* Role-based authorization

### Scalability

* Layered architecture
* Modular design
* Separation of concerns

### Maintainability

* TypeScript
* SQLAlchemy ORM
* Repository pattern
* Modular project structure

### Performance

* Indexed database queries
* Vector search using pgvector
* Cached frontend requests via TanStack Query

---

## 14. Project Scope

Included:

* Physical library management
* Digital library management
* QR-based circulation
* Reservations
* Fine management
* Notifications
* Ratings and reviews
* Recommendation system
* Semantic search

Excluded:

* Payment gateway integration
* Multi-branch libraries
* Vendor management
* Procurement management
* RFID systems
* Microservices architecture
* AI chatbots

---

## 15. Development Tools

- Cursor
- Git
- GitHub
- uv
- pnpm

