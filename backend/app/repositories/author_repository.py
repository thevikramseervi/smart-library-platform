"""Author repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.author import Author
from app.repositories.base import BaseRepository


class AuthorRepository(BaseRepository[Author]):
    """Database access for authors."""

    def __init__(self, db: Session) -> None:
        super().__init__(Author, db)

    def get_active_by_id(self, author_id: UUID) -> Author | None:
        """Fetch a non-deleted author by id."""
        statement = select(Author).where(
            Author.id == author_id,
            Author.deleted_at.is_(None),
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_active(self) -> list[Author]:
        """Return all non-deleted authors ordered by name."""
        statement = (
            select(Author)
            .where(Author.deleted_at.is_(None))
            .order_by(Author.name)
        )
        return list(self.db.execute(statement).scalars().all())

    def get_active_by_ids(self, author_ids: list[UUID]) -> list[Author]:
        """Fetch non-deleted authors matching the given ids."""
        if not author_ids:
            return []
        statement = select(Author).where(
            Author.id.in_(author_ids),
            Author.deleted_at.is_(None),
        )
        return list(self.db.execute(statement).scalars().all())

    def create(self, author: Author) -> Author:
        """Persist a new author."""
        self.db.add(author)
        self.db.flush()
        return author
