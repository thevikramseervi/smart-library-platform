"""Reservation endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.reservation import ReservationStatus
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.schemas.reservation import ReservationCreate, ReservationResponse
from app.services.reservation_service import ReservationService

router = APIRouter()


def get_reservation_service(db: Session = Depends(get_db)) -> ReservationService:
    """Provide a ReservationService for the current request."""
    return ReservationService(db)


def _is_staff(user: User) -> bool:
    """Return True when the user is admin or librarian."""
    return user.role.name.upper() in {"ADMIN", "LIBRARIAN"}


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    current_user: User = Depends(require_roles("STUDENT")),
    service: ReservationService = Depends(get_reservation_service),
) -> ReservationResponse:
    """Create a book reservation."""
    return service.create_reservation(current_user, payload)


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_reservation(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ReservationService = Depends(get_reservation_service),
) -> Response:
    """Cancel an active reservation."""
    service.cancel_reservation(
        reservation_id,
        current_user,
        is_staff=_is_staff(current_user),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=list[ReservationResponse])
def list_my_reservations(
    current_user: User = Depends(get_current_user),
    service: ReservationService = Depends(get_reservation_service),
) -> list[ReservationResponse]:
    """List reservations for the authenticated user."""
    return service.list_my_reservations(current_user)


@router.get("/queue/{book_id}", response_model=list[ReservationResponse])
def get_reservation_queue(
    book_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: ReservationService = Depends(get_reservation_service),
) -> list[ReservationResponse]:
    """Return FIFO reservation queue for a book."""
    return service.get_queue(book_id)


@router.get("", response_model=PaginatedResponse[ReservationResponse])
def list_reservations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    book_id: UUID | None = Query(default=None),
    status_filter: ReservationStatus | None = Query(default=None, alias="status"),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: ReservationService = Depends(get_reservation_service),
) -> PaginatedResponse[ReservationResponse]:
    """List reservations for staff."""
    return service.list_reservations(
        page=page,
        page_size=page_size,
        book_id=book_id,
        status_filter=status_filter,
    )
