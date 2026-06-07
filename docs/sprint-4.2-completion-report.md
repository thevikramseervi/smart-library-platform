# Sprint 4.2 — UX & Inventory Polish Completion Report

**Date:** 2026-06-07  
**Scope:** INR fines, return confirmation, copy lifecycle, languages documentation

---

## Verification

| Check | Result |
|-------|--------|
| `uv run alembic upgrade head` | Migration `004_book_copy_retired_status` applied |
| `uv run pytest` | **52 passed** (+4 new tests) |
| `pnpm build` | **Success** |

---

## 1. Fine Currency (INR)

- Added `frontend/src/lib/formatCurrency.ts` with `formatInr()` using `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`
- Applied on **My Fines** (student) and **Staff Fines** (librarian) pages

**Verification:** Amount `10.00` displays as `₹10.00` in en-IN locale.

---

## 2. Return Book Confirmation

- Added shadcn-style `Dialog` component (`frontend/src/components/ui/dialog.tsx`)
- **Return Book** page opens confirmation before return with:
  - Book title
  - Student name
  - Inventory code
  - Cancel / Confirm Return actions
- No API call until **Confirm Return** is clicked

**Verification:** Clicking **Return** opens dialog; **Cancel** closes without mutation; **Confirm Return** triggers `POST /transactions/return`.

---

## 3. Book Copy Lifecycle

### Backend

- Added `RETIRED` to `BookCopyStatus` (model + migration `004`)
- `LOST` and `DAMAGED` were already present in schema
- `BookCopyService.update_copy()` validates:
  - Cannot manually set `BORROWED` / `RESERVED`
  - Cannot set `LOST` / `DAMAGED` / `RETIRED` while copy is on loan
  - Cannot set `AVAILABLE` while an open loan exists

### Frontend

- Staff can change copy status from **Book Detail → Physical copies** table (dropdown for non-loaned copies)
- Manageable statuses: `AVAILABLE`, `LOST`, `DAMAGED`, `RETIRED`

**Verification:** Marking a copy `RETIRED` sets `available_copies = 0`; issue attempt returns 409.

---

## 4. Languages Module Review

**Finding:** Create-only behavior is intentional.

- API exposes `GET /languages` and `POST /languages` only
- No edit/delete endpoints exist

**Documentation added:** `docs/api-spec.md` — “Language management policy” section explaining stable reference data rationale.

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `alembic/versions/004_book_copy_retired_status.py` | **New** — add `RETIRED` enum value |
| `app/models/book_copy.py` | Add `RETIRED` |
| `app/services/book_copy_service.py` | Status update validation |
| `tests/test_book_copy_lifecycle.py` | **New** — 4 lifecycle tests |

### Frontend

| File | Change |
|------|--------|
| `src/lib/formatCurrency.ts` | **New** — INR formatter |
| `src/components/ui/dialog.tsx` | **New** — shadcn Dialog |
| `src/pages/circulation/MyFinesPage.tsx` | INR display |
| `src/pages/circulation/StaffFinesPage.tsx` | INR display |
| `src/pages/circulation/ReturnBookPage.tsx` | Confirmation dialog |
| `src/pages/catalog/BookDetailPage.tsx` | Copy status dropdown |
| `src/types/catalog.ts` | `RETIRED` + `STAFF_MANAGEABLE_COPY_STATUSES` |
| `package.json` / `pnpm-lock.yaml` | `@radix-ui/react-dialog` |

### Documentation

| File | Change |
|------|--------|
| `docs/database.md` | `RETIRED` + lifecycle note |
| `docs/api-spec.md` | Languages create-only policy |

---

## Migrations Added

| Revision | Description |
|----------|-------------|
| `004_book_copy_retired_status` | `ALTER TYPE bookcopystatus ADD VALUE 'RETIRED'` |

---

## Tests Added

`backend/tests/test_book_copy_lifecycle.py`:

1. `test_mark_copy_retired_reduces_available_count`
2. `test_retired_copy_cannot_be_issued`
3. `test_cannot_mark_borrowed_copy_as_lost`
4. `test_cannot_set_borrowed_status_manually`

---

## Remaining Limitations

| Area | Note |
|------|------|
| Return Book UI | Still capped at 100 active loans per page |
| Fine API JSON | Raw decimal strings unchanged; formatting is UI-only |
| Copy lifecycle | No audit trail for status changes |
| `RETIRED` downgrade | PostgreSQL enum value cannot be removed in migration downgrade |
| Frontend tests | No automated UI tests for dialog or INR formatting |
| QR / scanner | Not in Sprint 4.2 scope |

---

## Sprint 5

No Sprint 5 features were implemented in this pass.
