"""Circulation policy management endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.circulation_policy import (
    CirculationPolicyResponse,
    CirculationPolicyUpdate,
)
from app.services.circulation_policy_service import CirculationPolicyService

router = APIRouter()


def get_circulation_policy_service(db: Session = Depends(get_db)) -> CirculationPolicyService:
    """Provide CirculationPolicyService for the current request."""
    return CirculationPolicyService(db)


@router.get("", response_model=CirculationPolicyResponse)
def get_circulation_policy(
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: CirculationPolicyService = Depends(get_circulation_policy_service),
) -> CirculationPolicyResponse:
    """Get the active circulation policy."""
    return service.get_active_policy()


@router.put("", response_model=CirculationPolicyResponse)
def update_circulation_policy(
    payload: CirculationPolicyUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    service: CirculationPolicyService = Depends(get_circulation_policy_service),
) -> CirculationPolicyResponse:
    """Update circulation policy parameters (Admin only)."""
    return service.update_active_policy(payload, current_user)
