"""Dashboard endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.dashboard import (
    AdminDashboardResponse,
    LibrarianDashboardResponse,
    StudentDashboardResponse,
)
from app.services.dashboard_service import DashboardService

router = APIRouter()


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    """Provide a DashboardService for the current request."""
    return DashboardService(db)


@router.get("/student", response_model=StudentDashboardResponse)
def get_student_dashboard(
    current_user: User = Depends(require_roles("STUDENT")),
    service: DashboardService = Depends(get_dashboard_service),
) -> StudentDashboardResponse:
    """Return the authenticated student's dashboard summary."""
    return service.get_student_dashboard(current_user)


@router.get("/librarian", response_model=LibrarianDashboardResponse)
def get_librarian_dashboard(
    _current_user: User = Depends(require_roles("LIBRARIAN")),
    service: DashboardService = Depends(get_dashboard_service),
) -> LibrarianDashboardResponse:
    """Return the librarian dashboard summary."""
    return service.get_librarian_dashboard()


@router.get("/admin", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DashboardService = Depends(get_dashboard_service),
) -> AdminDashboardResponse:
    """Return the admin dashboard summary."""
    return service.get_admin_dashboard()
