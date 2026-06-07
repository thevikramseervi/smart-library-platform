"""Publisher repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.publisher import Publisher
from app.repositories.base import BaseRepository


class PublisherRepository(BaseRepository[Publisher]):
    """Database access for publishers."""

    def __init__(self, db: Session) -> None:
        super().__init__(Publisher, db)

    def get_active_by_id(self, publisher_id: UUID) -> Publisher | None:
        """Fetch a non-deleted publisher by id."""
        statement = select(Publisher).where(
            Publisher.id == publisher_id,
            Publisher.deleted_at.is_(None),
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_name(self, name: str, *, active_only: bool = True) -> Publisher | None:
        """Fetch a publisher by name."""
        statement = select(Publisher).where(Publisher.name == name)
        if active_only:
            statement = statement.where(Publisher.deleted_at.is_(None))
        return self.db.execute(statement).scalar_one_or_none()

    def list_active(self) -> list[Publisher]:
        """Return all non-deleted publishers ordered by name."""
        statement = (
            select(Publisher)
            .where(Publisher.deleted_at.is_(None))
            .order_by(Publisher.name)
        )
        return list(self.db.execute(statement).scalars().all())

    def create(self, publisher: Publisher) -> Publisher:
        """Persist a new publisher."""
        self.db.add(publisher)
        self.db.flush()
        return publisher
