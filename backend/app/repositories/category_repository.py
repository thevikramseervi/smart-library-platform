"""Category repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    """Database access for categories."""

    def __init__(self, db: Session) -> None:
        super().__init__(Category, db)

    def get_active_by_id(self, category_id: UUID) -> Category | None:
        """Fetch a non-deleted category by id."""
        statement = select(Category).where(
            Category.id == category_id,
            Category.deleted_at.is_(None),
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_name(self, name: str, *, active_only: bool = True) -> Category | None:
        """Fetch a category by name."""
        statement = select(Category).where(Category.name == name)
        if active_only:
            statement = statement.where(Category.deleted_at.is_(None))
        return self.db.execute(statement).scalar_one_or_none()

    def list_active(self) -> list[Category]:
        """Return all non-deleted categories ordered by name."""
        statement = (
            select(Category)
            .where(Category.deleted_at.is_(None))
            .order_by(Category.name)
        )
        return list(self.db.execute(statement).scalars().all())

    def get_active_by_ids(self, category_ids: list[UUID]) -> list[Category]:
        """Fetch non-deleted categories matching the given ids."""
        if not category_ids:
            return []
        statement = select(Category).where(
            Category.id.in_(category_ids),
            Category.deleted_at.is_(None),
        )
        return list(self.db.execute(statement).scalars().all())

    def create(self, category: Category) -> Category:
        """Persist a new category."""
        self.db.add(category)
        self.db.flush()
        return category
