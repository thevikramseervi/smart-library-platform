"""Administrator audit log endpoint."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.schemas.pagination import PaginatedResponse
from app.services.audit_log_service import AuditLogService

router = APIRouter()
AuditAction = Literal[
    "BOOK_CREATED",
    "BOOK_UPDATED",
    "BOOK_DELETED",
    "DIGITAL_RESOURCE_UPLOADED",
    "DIGITAL_RESOURCE_REMOVED",
    "COPY_CREATED",
    "COPY_UPDATED",
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DEACTIVATED",
    "USER_PASSWORD_RESET",
    "DEPARTMENT_CREATED",
    "DEPARTMENT_UPDATED",
    "DEPARTMENT_DELETED",
    "AUTHOR_CREATED",
    "AUTHOR_UPDATED",
    "AUTHOR_DELETED",
    "CATEGORY_CREATED",
    "CATEGORY_UPDATED",
    "CATEGORY_DELETED",
    "PUBLISHER_CREATED",
    "PUBLISHER_UPDATED",
    "PUBLISHER_DELETED",
    "LANGUAGE_CREATED",
    "BOOK_ISSUED",
    "BOOK_RETURNED",
    "BOOK_RENEWED",
    "FINE_RECORDED",
    "FINE_PAID",
    "CIRCULATION_POLICY_UPDATED",
    "RESERVATION_CREATED",
    "RESERVATION_CANCELLED",
    "RESERVATION_EXPIRED",
    "RESERVATION_FULFILLED",
]


def get_audit_log_service(db: Session = Depends(get_db)) -> AuditLogService:
    """Provide an AuditLogService for the current request."""
    return AuditLogService(db)


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: AuditAction | None = Query(default=None),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    start_date: date | None = None,
    end_date: date | None = None,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: AuditLogService = Depends(get_audit_log_service),
) -> PaginatedResponse[AuditLogResponse]:
    """List audit events visible to administrators."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Start date must be on or before end date.",
        )
    return service.list_events(
        page=page,
        page_size=page_size,
        action=action,
        q=q,
        start_date=start_date,
        end_date=end_date,
    )
