"""Category endpoints."""

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import CategoryService
from app.services.embedding_service import get_embedding_reindexer

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
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
) -> CategoryResponse:
    """Create a category."""
    return service.create_category(payload, current_user)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> CategoryResponse:
    """Update a category."""
    response, affected_book_ids = service.update_category(category_id, payload, actor=current_user)
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return response


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CategoryService = Depends(get_category_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> Response:
    """Soft delete a category."""
    affected_book_ids = service.delete_category(category_id, current_user)
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
