"""Database access for per-book digital PDF metadata."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.digital_resource import DigitalResource


class DigitalResourceRepository:
    """Read and write the single digital resource associated with each book."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_for_book(self, book_id: UUID) -> DigitalResource | None:
        return self.db.execute(
            select(DigitalResource).where(DigitalResource.book_id == book_id)
        ).scalar_one_or_none()
