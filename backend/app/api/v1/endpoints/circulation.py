"""Circulation helper endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.circulation import AvailableCopyResult, StudentSearchResult
from app.services.circulation_query_service import CirculationQueryService

router = APIRouter()


def get_circulation_query_service(db: Session = Depends(get_db)) -> CirculationQueryService:
    """Provide a CirculationQueryService for the current request."""
    return CirculationQueryService(db)


@router.get("/students/search", response_model=list[StudentSearchResult])
def search_students(
    q: str | None = Query(default=None),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CirculationQueryService = Depends(get_circulation_query_service),
) -> list[StudentSearchResult]:
    """Search students for issue workflows; omit q to list all active students."""
    return service.search_students(q)


@router.get("/copies/available", response_model=list[AvailableCopyResult])
def list_available_copies(
    book_id: UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CirculationQueryService = Depends(get_circulation_query_service),
) -> list[AvailableCopyResult]:
    """List available book copies for issue workflows."""
    return service.list_available_copies(book_id=book_id, query=q)
