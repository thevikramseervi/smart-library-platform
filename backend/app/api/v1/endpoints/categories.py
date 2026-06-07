"""Category endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import CategoryService

router = APIRouter()


def get_category_service(db: Session = Depends(get_db)) -> CategoryService:
    """Provide a CategoryService for the current request."""
    return CategoryService(db)


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    _current_user: User = Depends(get_current_user),
    service: CategoryService = Depends(get_category_service),
) -> list[CategoryResponse]:
    """List all active categories."""
    return service.list_categories()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: CategoryService = Depends(get_category_service),
) -> CategoryResponse:
    """Get a category by id."""
    return service.get_category(category_id)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
) -> CategoryResponse:
    """Create a category."""
    return service.create_category(payload)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
) -> CategoryResponse:
    """Update a category."""
    return service.update_category(category_id, payload)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
) -> Response:
    """Soft delete a category."""
    service.delete_category(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
