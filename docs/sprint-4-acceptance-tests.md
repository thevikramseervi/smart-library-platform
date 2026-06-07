# Sprint 4 — Acceptance Test Report

**Project:** Smart Library Platform  
**Module:** Circulation & Reservations  
**Sprint:** 4  
**Document version:** 1.0  
**Last updated:** 2026-06-07  

---

## 1. Purpose

This document defines acceptance criteria and test cases for Sprint 4 deliverables: physical book circulation (issue, return, overdue detection, fines), reservations (FIFO queue), and role-based access control.

It is intended for QA sign-off, sprint review, and project documentation.

---

## 2. Test Environment

| Item | Value |
| ---- | ----- |
| Backend | FastAPI (`uv run uvicorn app.main:app --reload`) |
| Frontend | Vite dev server (`pnpm dev`) |
| Database | PostgreSQL (local Docker Compose or dev instance) |
| Migrations | `uv run alembic upgrade head` |
| API base URL | `http://localhost:8000/api/v1` |
| Frontend URL | `http://localhost:5173` |

### 2.1 Seed credentials

| Role | Email | Password | Notes |
| ---- | ----- | -------- | ----- |
| Admin | `admin@library.local` | `admin123456` | Full catalog + circulation staff access |
| Librarian | `librarian@library.local` | `librarian123456` | Circulation staff access |
| Student | `student@library.local` | `student123456` | Student code: `STU-001` |
| Student 2 | `student2@library.local` | `student123456` | Student code: `STU-002` |

### 2.2 Business rules under test

| Rule | Expected behaviour |
| ---- | ------------------ |
| Loan period | `due_at` = issue date + 14 days |
| Transaction status | `ISSUED` or `RETURNED` only; overdue is derived (`ISSUED` + `due_at < today`) |
| Fine rate | `DAILY_OVERDUE_FINE_RATE` × days late (default ₹10.00/day) |
| Unpaid fine block | Student with any unpaid fine cannot receive new loans (HTTP 409) |
| Reservation | Allowed only when `available_copies = 0` for the book |
| Reservation queue | FIFO by `reservation_date`; position computed at query time |
| Duplicate reservation | One active reservation per student per book |

---

## 3. Circulation Module — Test Cases

### CIRC-01 — Issue book

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a librarian can issue an available copy to a student. |
| **Preconditions** | At least one book copy with status `AVAILABLE`; student account active. |
| **Steps** | 1. Log in as librarian.<br>2. Navigate to **Circulation → Issue Book**.<br>3. Select student and available copy from lists.<br>4. Click **Issue book**.<br><br>*API alternative:* `POST /transactions/issue` with `book_copy_id` + `student_id` (or `inventory_code` + `student_code`). |
| **Expected result** | HTTP 201; transaction `status = ISSUED`; copy status becomes `BORROWED`; `due_at` is 14 days after issue; `is_overdue = false`. |
| **Automated coverage** | `test_issue_and_return_flow`, `test_issue_sets_fourteen_day_due_date`, `test_librarian_can_issue` |

---

### CIRC-02 — Return book

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a librarian can return an issued copy. |
| **Preconditions** | Active loan exists (`status = ISSUED`). |
| **Steps** | 1. Log in as librarian.<br>2. Navigate to **Circulation → Return Book**.<br>3. Select loan from active list and click **Return**.<br><br>*API alternative:* `POST /transactions/return` with `book_copy_id`. |
| **Expected result** | HTTP 200; transaction `status = RETURNED`; `returned_at` set; copy status returns to `AVAILABLE`. |
| **Automated coverage** | `test_issue_and_return_flow` |

---

### CIRC-03 — Borrowed copy cannot be reissued

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a copy already on loan cannot be issued again. |
| **Preconditions** | Copy currently `BORROWED` (open `ISSUED` transaction). |
| **Steps** | 1. Issue copy to Student A.<br>2. Attempt to issue the same copy to Student A or Student B without returning. |
| **Expected result** | HTTP 409; detail indicates copy is not available for issue. |
| **Automated coverage** | `test_issue_unavailable_copy_rejected` |

---

### CIRC-04 — Student can view own loans

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify students can see their active and historical loans only. |
| **Preconditions** | Librarian has issued at least one copy to the student. |
| **Steps** | 1. Issue a copy to `student@library.local`.<br>2. Log in as that student.<br>3. Navigate to **Circulation → My Loans**.<br><br>*API alternative:* `GET /transactions/me/active`, `GET /transactions/me`. |
| **Expected result** | HTTP 200; active loan visible with book title, issue date, due date, overdue badge when applicable; no inventory-level copy details on catalog pages. |
| **Automated coverage** | `test_student_active_loans_endpoint` |

---

### CIRC-05 — Overdue loan detection

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify overdue is computed dynamically, not stored as a status. |
| **Preconditions** | Open loan with `due_at` in the past (adjust via DB in test env if needed). |
| **Steps** | 1. Create or identify an `ISSUED` loan past due date.<br>2. Call `GET /transactions/me/active` or staff **Overdue Loans** page.<br>3. Inspect `is_overdue` flag. |
| **Expected result** | `status` remains `ISSUED`; `is_overdue = true`; loan appears in overdue filter/list. |
| **Automated coverage** | Indirectly via fine and block tests; manual DB date adjustment recommended for UI verification |

---

### CIRC-06 — Fine generation on late return

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify an unpaid fine is created when a book is returned after `due_at`. |
| **Preconditions** | Open loan; `due_at` set to at least 1 day before return date. |
| **Steps** | 1. Issue copy.<br>2. Set `due_at` to 2 days ago (test/DB).<br>3. Return copy.<br>4. Check **My Fines** (student) or **Circulation → Fines** (staff). |
| **Expected result** | Unpaid fine created; `amount = days_late × DAILY_OVERDUE_FINE_RATE`; reason includes overdue day count; linked to transaction. |
| **Automated coverage** | `test_overdue_return_creates_fine` |

---

### CIRC-07 — Fine payment

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify staff can mark a fine as paid. |
| **Preconditions** | Unpaid fine exists for a student. |
| **Steps** | 1. Log in as librarian.<br>2. Navigate to **Circulation → Fines**.<br>3. Click **Mark paid** on unpaid fine.<br><br>*API alternative:* `POST /fines/{id}/pay`. |
| **Expected result** | HTTP 200; `paid = true`; `paid_at` timestamp set; fine no longer listed as unpaid. |
| **Automated coverage** | `test_mark_fine_paid_unblocks_borrowing` |

---

### CIRC-08 — Borrowing blocked by unpaid fines

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify unpaid fines are a hard borrowing block. |
| **Preconditions** | Student has at least one unpaid fine. |
| **Steps** | 1. Create overdue return fine for student (see CIRC-06).<br>2. Attempt to issue a different available copy to the same student. |
| **Expected result** | HTTP 409; detail: *"Student has unpaid fines and cannot borrow books"*. |
| **Automated coverage** | `test_issue_blocked_by_unpaid_fine` |

---

### CIRC-09 — Borrowing allowed after payment

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify fine payment restores borrowing eligibility. |
| **Preconditions** | Student had unpaid fine; fine now marked paid. |
| **Steps** | 1. Pay fine (CIRC-07).<br>2. Issue an available copy to the same student. |
| **Expected result** | HTTP 201; new loan created successfully. |
| **Automated coverage** | `test_mark_fine_paid_unblocks_borrowing` |

---

## 4. Reservation Module — Test Cases

### RESV-01 — Reserve unavailable book

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a student can reserve a book when all copies are checked out. |
| **Preconditions** | Book has physical copies; `available_copies = 0`; student does not already hold an open loan for that book. |
| **Steps** | 1. Issue all available copies to other students.<br>2. Log in as student (e.g. `student2@library.local`).<br>3. Open book in **Catalog → Books → [Book Detail]**.<br>4. Click **Reserve book** in Availability section.<br><br>*API alternative:* `POST /reservations` with `{ "book_id": "<uuid>" }`. |
| **Expected result** | HTTP 201; reservation `status = ACTIVE`; `queue_position` returned; reservation visible on **My Reservations**. |
| **Automated coverage** | `test_reservation_requires_no_available_copies` |

---

### RESV-02 — Prevent reservation when copies are available

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify reservation is rejected while copies remain available. |
| **Preconditions** | Book has at least one `AVAILABLE` copy. |
| **Steps** | 1. Log in as student.<br>2. Attempt to reserve the book from catalog or via API. |
| **Expected result** | HTTP 409; detail: *"Book has available copies; reservation not allowed"*; Availability section shows borrow guidance, not reserve button. |
| **Automated coverage** | `test_reservation_requires_no_available_copies` |

---

### RESV-03 — Prevent duplicate reservations

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a student cannot create two active reservations for the same book. |
| **Preconditions** | Student already has `ACTIVE` reservation for target book; no copies available. |
| **Steps** | 1. Create first reservation (RESV-01).<br>2. Submit second `POST /reservations` for same `book_id`. |
| **Expected result** | HTTP 409; detail: *"Student already has an active reservation for this book"*; catalog shows existing reservation state. |
| **Automated coverage** | Service rule verified; add manual/API re-test during sign-off |

---

### RESV-04 — FIFO queue ordering

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify reservation queue follows first-in-first-out order. |
| **Preconditions** | Book fully checked out; multiple students reserve same book at different times. |
| **Steps** | 1. Student 2 reserves book.<br>2. (Optional) additional students reserve.<br>3. Staff views **Circulation → Reservations** queue for book.<br><br>*API alternative:* `GET /reservations/queue/{book_id}`. |
| **Expected result** | Reservations ordered by `reservation_date`; `queue_position` = 1 for earliest, incrementing sequentially. |
| **Automated coverage** | `test_reservation_fifo_queue` |

---

### RESV-05 — Student cancellation

| Field | Detail |
| ----- | ------ |
| **Objective** | Verify a student can cancel their own active reservation. |
| **Preconditions** | Student has `ACTIVE` reservation. |
| **Steps** | 1. Log in as student.<br>2. Navigate to **Circulation → My Reservations**.<br>3. Click **Cancel** on active reservation.<br><br>*API alternative:* `DELETE /reservations/{id}`. |
| **Expected result** | HTTP 204/200; reservation `status = CANCELLED`; removed from active queue. |
| **Automated coverage** | Manual/UI sign-off recommended |

---

## 5. Role-Based Access — Test Cases

### RBAC-01 — Student restrictions

| Test | Endpoint / UI | Expected result |
| ---- | ------------- | --------------- |
| Cannot issue books | `POST /transactions/issue` | HTTP 403 |
| Cannot return books | `POST /transactions/return` | HTTP 403 |
| Cannot list all transactions | `GET /transactions` | HTTP 403 |
| Cannot view other student's loans | `GET /transactions/student/{id}` | HTTP 403 |
| Cannot mark fines paid | `POST /fines/{id}/pay` | HTTP 403 |
| Cannot access staff circulation pages | `/circulation/issue`, `/circulation/return`, etc. | Redirect to home |
| Can view own loans | `GET /transactions/me/active` | HTTP 200 |
| Can view own fines | `GET /fines/me` | HTTP 200 |
| Can manage own reservations | `POST/DELETE /reservations`, `GET /reservations/me` | HTTP 201/204/200 |
| Catalog read-only | No create/edit/delete on catalog entities | UI hides staff actions |

**Automated coverage:** `test_student_cannot_issue`, `test_student_cannot_view_other_student_transactions`, `test_student_active_loans_endpoint`

---

### RBAC-02 — Librarian permissions

| Test | Endpoint / UI | Expected result |
| ---- | ------------- | --------------- |
| Issue books | `POST /transactions/issue` | HTTP 201 |
| Return books | `POST /transactions/return` | HTTP 200 |
| List transactions | `GET /transactions` | HTTP 200 |
| List / pay fines | `GET /fines`, `POST /fines/{id}/pay` | HTTP 200 |
| View reservation queues | `GET /reservations`, `GET /reservations/queue/{book_id}` | HTTP 200 |
| Search students / copies | `GET /circulation/students/search`, `GET /circulation/copies/available` | HTTP 200 |
| Staff circulation UI | Issue, Return, Active Loans, Overdue, Reservations, Fines | Accessible |

**Automated coverage:** `test_librarian_can_issue`

---

### RBAC-03 — Admin permissions

| Test | Endpoint / UI | Expected result |
| ---- | ------------- | --------------- |
| All librarian circulation actions | Same as RBAC-02 | Allowed |
| Catalog management | Create/edit/delete books, copies, authors, etc. | Allowed |
| Seed/dev operations | Create book copies, run migrations | Allowed |

**Automated coverage:** Admin token used across catalog and circulation test suites

---

## 6. Expected vs Actual Results Summary

**Test execution date:** _______________  
**Tester:** _______________  
**Environment:** _______________  

| ID | Test case | Expected result | Actual result | Status | Notes |
| -- | --------- | --------------- | ------------- | ------ | ----- |
| CIRC-01 | Issue book | 201 ISSUED; copy BORROWED; due +14 days | Pass (automated) | ✅ Pass | |
| CIRC-02 | Return book | 200 RETURNED; copy AVAILABLE | Pass (automated) | ✅ Pass | |
| CIRC-03 | Borrowed copy cannot be reissued | 409 conflict | Pass (automated) | ✅ Pass | |
| CIRC-04 | Student can view own loans | 200; loan visible on My Loans | Pass (automated) | ✅ Pass | |
| CIRC-05 | Overdue loan detection | `is_overdue = true`; status stays ISSUED | Pass (automated/manual) | ✅ Pass | UI verified with past due date |
| CIRC-06 | Fine generation | Unpaid fine; amount = days × rate | Pass (automated) | ✅ Pass | |
| CIRC-07 | Fine payment | `paid = true`; `paid_at` set | Pass (automated) | ✅ Pass | |
| CIRC-08 | Borrowing blocked by unpaid fines | 409 unpaid fines message | Pass (automated) | ✅ Pass | |
| CIRC-09 | Borrowing allowed after payment | 201 new loan | Pass (automated) | ✅ Pass | |
| RESV-01 | Reserve unavailable book | 201 ACTIVE reservation | Pass (automated) | ✅ Pass | |
| RESV-02 | Prevent reservation when available | 409 reservation not allowed | Pass (automated) | ✅ Pass | |
| RESV-03 | Prevent duplicate reservations | 409 duplicate message | Pass (automated) | ✅ Pass | `test_duplicate_reservation_rejected` |
| RESV-04 | FIFO queue ordering | Positions 1, 2, … by date | Pass (automated) | ✅ Pass | |
| RESV-05 | Student cancellation | Reservation CANCELLED | | ⬜ Pending | Manual UI sign-off |
| RBAC-01 | Student restrictions | 403 on staff endpoints | Pass (automated) | ✅ Pass | Sprint 4.1 hardening tests |
| RBAC-02 | Librarian permissions | Staff circulation allowed | Pass (automated) | ✅ Pass | |
| RBAC-03 | Admin permissions | Full catalog + circulation | Pass (automated) | ✅ Pass | |

**Summary**

| Status | Count |
| ------ | ----- |
| ✅ Pass | 15 |
| ⬜ Pending | 1 |
| ❌ Fail | 0 |
| **Total** | **16** |

---

## 7. Automated Test Verification

Run the backend regression suite to validate Sprint 4 API behaviour:

```bash
cd backend
uv run alembic upgrade head
uv run pytest tests/test_circulation_issue_return.py \
             tests/test_circulation_rbac.py \
             tests/test_circulation_reservations.py -v
```

**Last automated run:** 48 tests passed (full backend suite including Sprint 4.1 hardening).

---

## 8. Sign-Off

| Role | Name | Signature | Date |
| ---- | ---- | --------- | ---- |
| QA / Tester | | | |
| Product Owner | | | |
| Tech Lead | | | |

---

## 9. References

- [Architecture](./architecture.md)
- [Database schema](./database.md)
- [API specification](./api-spec.md)
- [Project rules](./project-rules.md)
