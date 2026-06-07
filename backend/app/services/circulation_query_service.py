"""Circulation lookup helpers for staff UI."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.circulation_repository import CirculationRepository
from app.schemas.circulation import AvailableCopyResult, StudentSearchResult


class CirculationQueryService:
    """Read-only circulation search helpers."""

    def __init__(self, db: Session) -> None:
        self.repository = CirculationRepository(db)

    def search_students(self, query: str | None = None) -> list[StudentSearchResult]:
        """Search students for issue workflows; returns all students when query is empty."""
        if query and query.strip():
            students = self.repository.search_students(query.strip())
        else:
            students = self.repository.list_students()
        return [StudentSearchResult.model_validate(student) for student in students]

    def list_available_copies(
        self,
        *,
        book_id: UUID | None = None,
        query: str | None = None,
    ) -> list[AvailableCopyResult]:
        """List available copies for issue workflows."""
        copies = self.repository.list_available_copies(book_id=book_id, query=query)
        return [
            AvailableCopyResult(
                id=copy.id,
                inventory_code=copy.inventory_code,
                book_id=copy.book_id,
                book_title=copy.book.title,
                location=copy.location,
            )
            for copy in copies
        ]
