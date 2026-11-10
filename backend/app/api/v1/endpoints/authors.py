"""Author endpoints."""

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.models.user import User
from app.schemas.author import AuthorCreate, AuthorResponse, AuthorUpdate
from app.services.author_service import AuthorService
from app.services.embedding_service import get_embedding_reindexer

router = APIRouter()


def get_author_service(db: Session = Depends(get_db)) -> AuthorService:
    """Provide an AuthorService for the current request."""
    return AuthorService(db)


@router.get("", response_model=list[AuthorResponse])
def list_authors(
    _current_user: User = Depends(get_current_user),
    service: AuthorService = Depends(get_author_service),
) -> list[AuthorResponse]:
    """List all active authors."""
    return service.list_authors()


@router.get("/{author_id}", response_model=AuthorResponse)
def get_author(
    author_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: AuthorService = Depends(get_author_service),
) -> AuthorResponse:
    """Get an author by id."""
    return service.get_author(author_id)


@router.post("", response_model=AuthorResponse, status_code=status.HTTP_201_CREATED)
def create_author(
    payload: AuthorCreate,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
) -> AuthorResponse:
    """Create an author."""
    return service.create_author(payload, current_user)


@router.put("/{author_id}", response_model=AuthorResponse)
def update_author(
    author_id: UUID,
    payload: AuthorUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> AuthorResponse:
    """Update an author."""
    response, affected_book_ids = service.update_author(author_id, payload, actor=current_user)
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return response


@router.delete("/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_author(
    author_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> Response:
    """Soft delete an author."""
    affected_book_ids = service.delete_author(author_id, current_user)
    if settings.SEMANTIC_SEARCH_ENABLED:
        for book_id in affected_book_ids:
            background_tasks.add_task(reindex_book, str(book_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
