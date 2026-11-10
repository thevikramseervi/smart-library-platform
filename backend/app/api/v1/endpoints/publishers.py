"""Publisher endpoints."""

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.models.user import User
from app.schemas.publisher import PublisherCreate, PublisherResponse, PublisherUpdate
from app.services.embedding_service import get_embedding_reindexer
from app.services.publisher_service import PublisherService

router = APIRouter()


def get_publisher_service(db: Session = Depends(get_db)) -> PublisherService:
    """Provide a PublisherService for the current request."""
    return PublisherService(db)


@router.get("", response_model=list[PublisherResponse])
def list_publishers(
    _current_user: User = Depends(get_current_user),
    service: PublisherService = Depends(get_publisher_service),
) -> list[PublisherResponse]:
    """List all active publishers."""
    return service.list_publishers()


@router.get("/{publisher_id}", response_model=PublisherResponse)
def get_publisher(
    publisher_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: PublisherService = Depends(get_publisher_service),
) -> PublisherResponse:
    """Get a publisher by id."""
    return service.get_publisher(publisher_id)


@router.post("", response_model=PublisherResponse, status_code=status.HTTP_201_CREATED)
def create_publisher(
    payload: PublisherCreate,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
) -> PublisherResponse:
    """Create a publisher."""
    return service.create_publisher(payload, current_user)


@router.put("/{publisher_id}", response_model=PublisherResponse)
def update_publisher(
    publisher_id: UUID,
    payload: PublisherUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> PublisherResponse:
    """Update a publisher."""
    response, affected_book_ids = service.update_publisher(
        publisher_id, payload, actor=current_user
    )
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return response


@router.delete("/{publisher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_publisher(
    publisher_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> Response:
    """Soft delete a publisher."""
    affected_book_ids = service.delete_publisher(publisher_id, current_user)
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
