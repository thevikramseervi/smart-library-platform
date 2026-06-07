"""Book copy business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.book_copy import BookCopy, BookCopyStatus
from app.repositories.book_copy_repository import BookCopyRepository
from app.repositories.book_repository import BookRepository
from app.schemas.book_copy import BookCopyCreate, BookCopyResponse, BookCopyUpdate


class BookCopyService:
    """Service layer for book copy management."""

    def __init__(self, db: Session) -> None:
        self.repository = BookCopyRepository(db)
        self.book_repository = BookRepository(db)
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

        if self.repository.get_by_inventory_code(payload.inventory_code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory code already exists",
            )

        book_copy = BookCopy(
            book_id=payload.book_id,
            inventory_code=payload.inventory_code,
            qr_code_value=payload.inventory_code,
            location=payload.location,
            status=payload.status,
            acquired_date=payload.acquired_date,
        )
        created = self.repository.create(book_copy)
        self.db.commit()
        self.db.refresh(created)
        return BookCopyResponse.model_validate(created)

    def update_copy(self, copy_id: UUID, payload: BookCopyUpdate) -> BookCopyResponse:
        """Update a book copy."""
        book_copy = self.repository.get_by_id(copy_id)
        if book_copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")

        if payload.location is not None:
            book_copy.location = payload.location
        if payload.status is not None:
            book_copy.status = payload.status
        if payload.acquired_date is not None:
            book_copy.acquired_date = payload.acquired_date

        self.db.commit()
        self.db.refresh(book_copy)
        return BookCopyResponse.model_validate(book_copy)
