# Sprint 4.1 — Hardening & Polish Completion Report

**Date:** 2026-06-07  
**Scope:** Production-readiness fixes from Sprint 4 audit (no Sprint 5 features)

---

## Verification

| Check | Result |
|-------|--------|
| `uv run pytest` | **48 passed** (+5 new tests) |
| `pnpm build` | **Success** |

---

## Bugs Fixed

| # | Issue | Fix |
|---|--------|-----|
| 1 | Reservation expiry rolled back on read paths | `_expire_stale()` now commits when stale rows are found |
| 2 | Concurrent issue/reservation could return HTTP 500 | `commit_or_raise_conflict()` maps `IntegrityError` → HTTP 409 |
| 3 | Students could read inventory via `GET /book-copies` | List and get copy endpoints restricted to Admin/Librarian |
| 4 | Students could call staff `GET /transactions` | Endpoint restricted to Admin/Librarian |
| 5 | ReservationsQueuePage quick-pick chips never rendered | `Object.keys(map)` → `booksWithReservations.size` |
| 6 | Reserve button shown before reservations loaded | Availability actions gated on `myReservationsQuery.isSuccess` |
| 7 | My Loans showed inventory codes to students | Removed copy column; book titles link to catalog |
| 8 | Issue Book stale copy list after issue | Query cache invalidation for copies and transactions |
| 9 | Cancel/pay mutations failed silently | `getApiErrorMessage` on My Reservations and Staff Fines |

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/app/core/db_errors.py` | **New** — `commit_or_raise_conflict()` helper |
| `backend/app/repositories/reservation_repository.py` | `expire_stale()` returns bool |
| `backend/app/services/reservation_service.py` | Persist expiry; IntegrityError on create |
| `backend/app/services/transaction_service.py` | IntegrityError on issue commit |
| `backend/app/api/v1/endpoints/book_copies.py` | Staff-only GET list/get |
| `backend/app/api/v1/endpoints/transactions.py` | Staff-only `GET /transactions` |
| `backend/tests/test_circulation_hardening.py` | **New** — 5 hardening tests |
| `backend/tests/test_circulation_rbac.py` | Updated student list transactions test |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/pages/catalog/BookDetailPage.tsx` | Reservation loading gate |
| `frontend/src/pages/circulation/ReservationsQueuePage.tsx` | Map.size fix |
| `frontend/src/pages/circulation/MyLoansPage.tsx` | Hide inventory; error states |
| `frontend/src/pages/circulation/IssueBookPage.tsx` | Cache invalidation after issue |
| `frontend/src/pages/circulation/MyReservationsPage.tsx` | Cancel error feedback |
| `frontend/src/pages/circulation/StaffFinesPage.tsx` | Pay error feedback |

### Documentation

| File | Change |
|------|--------|
| `docs/api-spec.md` | Book copy GET access; staff-only note |
| `docs/sprint-4-acceptance-tests.md` | RESV-03/RBAC automation notes; 48-test count |

---

## Tests Added

`backend/tests/test_circulation_hardening.py`:

1. `test_student_cannot_list_transactions` — `GET /transactions` → 403
2. `test_student_cannot_list_book_copies` — `GET /book-copies` → 403
3. `test_student_cannot_return_book` — `POST /transactions/return` → 403
4. `test_duplicate_reservation_rejected` — second reservation → 409
5. `test_stale_reservation_expires_on_list` — expiry persisted via `GET /reservations/me`

---

## Remaining Known Limitations

| Area | Limitation |
|------|------------|
| Return Book UI | Still loads max 100 active loans (`page_size: 100`) |
| Issue Book UI | Loads all students/copies upfront (up to API limits) |
| Student loan API | `GET /transactions/me/active` still includes `inventory_code` in JSON (UI hidden only) |
| Staff reservation queue | API responses lack student name/code for desk fulfillment |
| Staff fines list | API responses lack student identity column data |
| QR workflows | No scanner UI; codes supported in API only |
| CI/CD | No GitHub Actions workflow yet |
| Frontend tests | No Vitest/Playwright harness |
| Reservation fulfillment | Queue head not auto-prioritized on copy return |
| N+1 queries | Queue position computed per row in reservation lists |
| Currency display | Fines UI shows `$` instead of INR |
| RESV-05 | Student cancel flow — manual UI sign-off still pending |

---

## Sprint 5 Readiness

Sprint 4.1 resolved the **Priority 1 and Priority 2** audit items. The codebase is suitable to **begin Sprint 5 feature work** on notifications, QR UI, and digital resources.

Production deployment should still address Return Book pagination, CI pipeline, and staff API enrichment before go-live.
