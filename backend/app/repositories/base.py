"""Base repository with common database operations."""

from datetime import UTC, datetime
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic repository for basic CRUD operations."""

    def __init__(self, model: type[ModelType], db: Session) -> None:
        self.model = model
        self.db = db

    def get_by_id(self, entity_id: UUID) -> ModelType | None:
        """Fetch a single entity by primary key."""
        return self.db.get(self.model, entity_id)

    def soft_delete(self, entity: ModelType) -> ModelType:
        """Set deleted_at on an entity supporting soft delete."""
        entity.deleted_at = datetime.now(UTC)  # type: ignore[attr-defined]
        self.db.flush()
        return entity
