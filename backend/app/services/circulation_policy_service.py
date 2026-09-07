"""Circulation policy service."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.circulation_policy_repository import CirculationPolicyRepository
from app.schemas.circulation_policy import (
    CirculationPolicyResponse,
    CirculationPolicyUpdate,
)


class CirculationPolicyService:
    """Service layer for circulation policy configuration."""

    def __init__(self, db: Session) -> None:
        self.repository = CirculationPolicyRepository(db)
        self.db = db

    def get_active_policy(self) -> CirculationPolicyResponse:
        """Return the current active circulation policy."""
        policy = self.repository.get_active()
        return CirculationPolicyResponse.model_validate(policy)

    def update_active_policy(
        self,
        payload: CirculationPolicyUpdate,
        admin_user: User,
    ) -> CirculationPolicyResponse:
        """Update active circulation policy parameters with admin audit logging."""
        updated = self.repository.update_active(payload, admin_user.id)
        return CirculationPolicyResponse.model_validate(updated)
