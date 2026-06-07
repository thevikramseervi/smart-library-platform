"""Book copy business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.book_copy import BookCopy, BookCopyStatus
from app.repositories.book_copy_repository import BookCopyRepository
from app.repositories.book_repository import BookRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.book_copy import BookCopyCreate, BookCopyResponse, BookCopyUpdate

CIRCULATION_MANAGED_STATUSES = {BookCopyStatus.BORROWED, BookCopyStatus.RESERVED}
INACTIVE_COPY_STATUSES = {BookCopyStatus.LOST, BookCopyStatus.DAMAGED, BookCopyStatus.RETIRED}


class BookCopyService:
    """Service layer for book copy management."""

    def __init__(self, db: Session) -> None:
        self.repository = BookCopyRepository(db)
        self.book_repository = BookRepository(db)
        self.transaction_repository = TransactionRepository(db)
        self.db = db

    def list_copies(
        self,
        *,
        book_id: UUID | None = None,
        status: BookCopyStatus | None = None,
    ) -> list[BookCopyResponse]:
        """Return book copies with optional filters."""
        copies = self.repository.list_copies(book_id=book_id, status=status)
        return [BookCopyResponse.model_validate(copy) for copy in copies]

    def get_copy(self, copy_id: UUID) -> BookCopyResponse:
        """Return a book copy by id."""
        book_copy = self.repository.get_by_id(copy_id)
        if book_copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")
        return BookCopyResponse.model_validate(book_copy)

    def create_copy(self, payload: BookCopyCreate) -> BookCopyResponse:
        """Create a book copy with qr_code_value equal to inventory_code."""
        book = self.book_repository.get_active_by_id(payload.book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Book not found")

        inventory_code = payload.inventory_code or self._generate_inventory_code(payload.book_id)

        if self.repository.get_by_inventory_code(inventory_code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory code already exists",
            )

        book_copy = BookCopy(
            book_id=payload.book_id,
            inventory_code=inventory_code,
            qr_code_value=inventory_code,
            location=payload.location,
            status=payload.status,
            acquired_date=payload.acquired_date,
        )
        created = self.repository.create(book_copy)
        self.db.commit()
        self.db.refresh(created)
        return BookCopyResponse.model_validate(created)

    def _generate_inventory_code(self, book_id: UUID) -> str:
        """Generate a unique inventory code for a book copy."""
        book_prefix = str(book_id).replace("-", "")[:8].upper()
        sequence = self.repository.count_by_book(book_id) + 1
        for _ in range(100):
            candidate = f"BK-{book_prefix}-{sequence:03d}"
            if self.repository.get_by_inventory_code(candidate) is None:
                return candidate
            sequence += 1
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate inventory code",
        )

    def update_copy(self, copy_id: UUID, payload: BookCopyUpdate) -> BookCopyResponse:
        """Update a book copy."""
        book_copy = self.repository.get_by_id(copy_id)
        if book_copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")

        if payload.location is not None:
            book_copy.location = payload.location
        if payload.status is not None:
            self._apply_status_update(book_copy, payload.status)
        if payload.acquired_date is not None:
            book_copy.acquired_date = payload.acquired_date

        self.db.commit()
        self.db.refresh(book_copy)
        return BookCopyResponse.model_validate(book_copy)

    def _apply_status_update(self, book_copy: BookCopy, new_status: BookCopyStatus) -> None:
        """Validate and apply a staff-initiated copy status change."""
        if new_status in CIRCULATION_MANAGED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Copy status is managed by circulation workflows",
            )

        open_loan = self.transaction_repository.get_open_for_copy(book_copy.id)

        if new_status == BookCopyStatus.AVAILABLE and open_loan is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Copy has an open loan and cannot be marked available",
            )

        if new_status in INACTIVE_COPY_STATUSES:
            if book_copy.status == BookCopyStatus.BORROWED or open_loan is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Return the copy before marking it lost, damaged, or retired",
                )

        book_copy.status = new_status
