"""Fine endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.fine import FineResponse
from app.schemas.pagination import PaginatedResponse
from app.services.fine_service import FineService

router = APIRouter()


def get_fine_service(db: Session = Depends(get_db)) -> FineService:
    """Provide a FineService for the current request."""
    return FineService(db)


@router.get("/me", response_model=list[FineResponse])
def list_my_fines(
    current_user: User = Depends(get_current_user),
    service: FineService = Depends(get_fine_service),
) -> list[FineResponse]:
    """List fines for the authenticated student."""
    return service.list_my_fines(current_user)


@router.get("", response_model=PaginatedResponse[FineResponse])
def list_fines(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    paid: bool | None = Query(default=None),
    student_id: UUID | None = Query(default=None),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: FineService = Depends(get_fine_service),
) -> PaginatedResponse[FineResponse]:
    """List fines for staff."""
    return service.list_fines(
        page=page,
        page_size=page_size,
        paid=paid,
        student_id=student_id,
    )


@router.post("/{fine_id}/pay", response_model=FineResponse)
def mark_fine_paid(
    fine_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: FineService = Depends(get_fine_service),
) -> FineResponse:
    """Mark a fine as paid."""
    return service.mark_paid(fine_id)
