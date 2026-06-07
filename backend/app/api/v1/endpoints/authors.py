"""Author endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.author import AuthorCreate, AuthorResponse, AuthorUpdate
from app.services.author_service import AuthorService

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
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
) -> AuthorResponse:
    """Create an author."""
    return service.create_author(payload)


@router.put("/{author_id}", response_model=AuthorResponse)
def update_author(
    author_id: UUID,
    payload: AuthorUpdate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
) -> AuthorResponse:
    """Update an author."""
    return service.update_author(author_id, payload)


@router.delete("/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_author(
    author_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: AuthorService = Depends(get_author_service),
) -> Response:
    """Soft delete an author."""
    service.delete_author(author_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
