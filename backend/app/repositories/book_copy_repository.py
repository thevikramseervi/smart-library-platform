"""Book copy repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.book_copy import BookCopy, BookCopyStatus
from app.repositories.base import BaseRepository


class BookCopyRepository(BaseRepository[BookCopy]):
    """Database access for book copies."""

    def __init__(self, db: Session) -> None:
        super().__init__(BookCopy, db)

    def get_by_id(self, copy_id: UUID) -> BookCopy | None:
        """Fetch a book copy by id."""
        return super().get_by_id(copy_id)

    def get_by_inventory_code(self, inventory_code: str) -> BookCopy | None:
        """Fetch a book copy by inventory code."""
        statement = select(BookCopy).where(BookCopy.inventory_code == inventory_code)
        return self.db.execute(statement).scalar_one_or_none()

    def list_copies(
        self,
        *,
        book_id: UUID | None = None,
        status: BookCopyStatus | None = None,
    ) -> list[BookCopy]:
        """Return book copies with optional filters."""
        statement = select(BookCopy)
        if book_id is not None:
            statement = statement.where(BookCopy.book_id == book_id)
        if status is not None:
            statement = statement.where(BookCopy.status == status)
        statement = statement.order_by(BookCopy.inventory_code)
        return list(self.db.execute(statement).scalars().all())

    def count_by_book(self, book_id: UUID) -> int:
        """Return total copy count for a book."""
        statement = (
            select(func.count())
            .select_from(BookCopy)
            .where(BookCopy.book_id == book_id)
        )
        return self.db.execute(statement).scalar_one()

    def count_available_by_book(self, book_id: UUID) -> int:
        """Return available copy count for a book."""
        statement = (
            select(func.count())
            .select_from(BookCopy)
            .where(
                BookCopy.book_id == book_id,
                BookCopy.status == BookCopyStatus.AVAILABLE,
            )
        )
        return self.db.execute(statement).scalar_one()

    def create(self, book_copy: BookCopy) -> BookCopy:
        """Persist a new book copy."""
        self.db.add(book_copy)
        self.db.flush()
        return book_copy
