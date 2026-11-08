"""Book endpoints."""

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.models.user import User
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.book_service import BookService
from app.services.embedding_service import get_embedding_reindexer

router = APIRouter()


def get_book_service(db: Session = Depends(get_db)) -> BookService:
    """Provide a BookService for the current request."""
    return BookService(db)


@router.get("", response_model=PaginatedResponse[BookResponse])
def list_books(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    author_id: UUID | None = Query(default=None),
    sort: str | None = Query(default=None),
    _current_user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
) -> PaginatedResponse[BookResponse]:
    """List books with pagination, search, and filters."""
    return service.list_books(
        page=page,
        page_size=page_size,
        q=q,
        category_id=category_id,
        author_id=author_id,
        sort=sort,
    )


@router.get("/{book_id}", response_model=BookResponse)
def get_book(
    book_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
) -> BookResponse:
    """Get a book by id."""
    return service.get_book(book_id)


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    background_tasks: BackgroundTasks,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookService = Depends(get_book_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> BookResponse:
    """Create a book."""
    created = service.create_book(payload)
    if settings.SEMANTIC_SEARCH_ENABLED:
        background_tasks.add_task(reindex_book, str(created.id))
    return created


@router.put("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: UUID,
    payload: BookUpdate,
    background_tasks: BackgroundTasks,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookService = Depends(get_book_service),
    reindex_book: Callable[[str], None] = Depends(get_embedding_reindexer),
) -> BookResponse:
    """Update a book."""
    updated = service.update_book(book_id, payload)
    if settings.SEMANTIC_SEARCH_ENABLED:
        background_tasks.add_task(reindex_book, str(updated.id))
    return updated


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookService = Depends(get_book_service),
) -> Response:
    """Soft delete a book."""
    service.delete_book(book_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
