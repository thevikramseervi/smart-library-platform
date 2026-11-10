"""Administrative reporting endpoints."""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.reports import CirculationReportResponse
from app.services.circulation_reports_service import CirculationReportsService

router = APIRouter()


def get_reports_service(db: Session = Depends(get_db)) -> CirculationReportsService:
    """Provide a CirculationReportsService for the current request."""
    return CirculationReportsService(db)


@router.get("/circulation", response_model=CirculationReportResponse)
def get_circulation_report(
    start_date: date | None = None,
    end_date: date | None = None,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: CirculationReportsService = Depends(get_reports_service),
) -> CirculationReportResponse:
    """Return a circulation report for the selected UTC calendar period."""
    return service.get_report(start_date=start_date, end_date=end_date)
