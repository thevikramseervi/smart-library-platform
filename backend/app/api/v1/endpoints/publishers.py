"""Publisher endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.publisher import PublisherCreate, PublisherResponse, PublisherUpdate
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
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
) -> PublisherResponse:
    """Create a publisher."""
    return service.create_publisher(payload)


@router.put("/{publisher_id}", response_model=PublisherResponse)
def update_publisher(
    publisher_id: UUID,
    payload: PublisherUpdate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
) -> PublisherResponse:
    """Update a publisher."""
    return service.update_publisher(publisher_id, payload)


@router.delete("/{publisher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_publisher(
    publisher_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: PublisherService = Depends(get_publisher_service),
) -> Response:
    """Soft delete a publisher."""
    service.delete_publisher(publisher_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
