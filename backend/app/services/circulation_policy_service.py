"""Circulation policy service."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.circulation_policy_repository import CirculationPolicyRepository
from app.schemas.circulation_policy import (
    CirculationPolicyResponse,
    CirculationPolicyUpdate,
)
from app.services.audit_log_service import AuditLogService


class CirculationPolicyService:
    """Service layer for circulation policy configuration."""

    def __init__(self, db: Session) -> None:
        self.repository = CirculationPolicyRepository(db)
        self.audit_log_service = AuditLogService(db)
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
        previous = self.repository.get_active()
        updated = self.repository.update_active(payload, admin_user.id)
        previous_values = {
            "daily_overdue_fine_rate": str(previous.daily_overdue_fine_rate),
            "max_fine_amount": str(previous.max_fine_amount),
            "loan_period_days": previous.loan_period_days,
            "max_active_loans": previous.max_active_loans,
            "max_renewals": previous.max_renewals,
            "reservation_expiry_days": previous.reservation_expiry_days,
        }
        new_values = {
            "daily_overdue_fine_rate": str(updated.daily_overdue_fine_rate),
            "max_fine_amount": str(updated.max_fine_amount),
            "loan_period_days": updated.loan_period_days,
            "max_active_loans": updated.max_active_loans,
            "max_renewals": updated.max_renewals,
            "reservation_expiry_days": updated.reservation_expiry_days,
        }
        changed = {
            key: {"before": previous_values[key], "after": new_values[key]}
            for key in previous_values
            if previous_values[key] != new_values[key]
        }
        if changed:
            self.audit_log_service.record(
                actor=admin_user,
                action="CIRCULATION_POLICY_UPDATED",
                entity_type="CIRCULATION_POLICY",
                entity_id=updated.id,
                summary=f"Updated circulation policy ({len(changed)} setting(s) changed)",
                details={"changes": changed},
            )
        self.db.commit()
        return CirculationPolicyResponse.model_validate(updated)
