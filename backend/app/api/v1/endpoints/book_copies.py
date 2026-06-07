"""Book copy endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.book_copy import BookCopyStatus
from app.models.user import User
from app.schemas.book_copy import BookCopyCreate, BookCopyResponse, BookCopyUpdate
from app.services.book_copy_service import BookCopyService

router = APIRouter()


def get_book_copy_service(db: Session = Depends(get_db)) -> BookCopyService:
    """Provide a BookCopyService for the current request."""
    return BookCopyService(db)


@router.get("", response_model=list[BookCopyResponse])
def list_book_copies(
    book_id: UUID | None = Query(default=None),
    status_filter: BookCopyStatus | None = Query(default=None, alias="status"),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookCopyService = Depends(get_book_copy_service),
) -> list[BookCopyResponse]:
    """List book copies with optional filters."""
    return service.list_copies(book_id=book_id, status=status_filter)


@router.get("/{copy_id}", response_model=BookCopyResponse)
def get_book_copy(
    copy_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookCopyService = Depends(get_book_copy_service),
) -> BookCopyResponse:
    """Get a book copy by id."""
    return service.get_copy(copy_id)


@router.post("", response_model=BookCopyResponse, status_code=status.HTTP_201_CREATED)
def create_book_copy(
    payload: BookCopyCreate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookCopyService = Depends(get_book_copy_service),
) -> BookCopyResponse:
    """Create a book copy."""
    return service.create_copy(payload)


@router.put("/{copy_id}", response_model=BookCopyResponse)
def update_book_copy(
    copy_id: UUID,
    payload: BookCopyUpdate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: BookCopyService = Depends(get_book_copy_service),
) -> BookCopyResponse:
    """Update a book copy."""
    return service.update_copy(copy_id, payload)
