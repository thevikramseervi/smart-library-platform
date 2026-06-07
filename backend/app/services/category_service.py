"""Category business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category import Category
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate


class CategoryService:
    """Service layer for category management."""

    def __init__(self, db: Session) -> None:
        self.repository = CategoryRepository(db)
        self.db = db

    def list_categories(self) -> list[CategoryResponse]:
        """Return all active categories."""
        categories = self.repository.list_active()
        return [CategoryResponse.model_validate(cat) for cat in categories]

    def get_category(self, category_id: UUID) -> CategoryResponse:
        """Return a category by id."""
        category = self.repository.get_active_by_id(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        return CategoryResponse.model_validate(category)

    def create_category(self, payload: CategoryCreate) -> CategoryResponse:
        """Create a category with unique name."""
        if self.repository.get_by_name(payload.name, active_only=False) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category name already exists",
            )

        category = Category(name=payload.name, description=payload.description)
        created = self.repository.create(category)
        self.db.commit()
        self.db.refresh(created)
        return CategoryResponse.model_validate(created)

    def update_category(self, category_id: UUID, payload: CategoryUpdate) -> CategoryResponse:
        """Update an active category."""
        category = self.repository.get_active_by_id(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        if payload.name is not None and payload.name != category.name:
            existing = self.repository.get_by_name(payload.name, active_only=False)
            if existing is not None and existing.id != category.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Category name already exists",
                )
            category.name = payload.name

        if payload.description is not None:
            category.description = payload.description

        self.db.commit()
        self.db.refresh(category)
        return CategoryResponse.model_validate(category)

    def delete_category(self, category_id: UUID) -> None:
        """Soft delete a category."""
        category = self.repository.get_active_by_id(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        self.repository.soft_delete(category)
        self.db.commit()
