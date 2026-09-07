"""Circulation policy repository."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.circulation_policy import CirculationPolicy
from app.repositories.base import BaseRepository
from app.schemas.circulation_policy import CirculationPolicyUpdate


class CirculationPolicyRepository(BaseRepository[CirculationPolicy]):
    """Database access for circulation policies."""

    def __init__(self, db: Session) -> None:
        super().__init__(CirculationPolicy, db)

    def get_active(self) -> CirculationPolicy:
        """Fetch the active circulation policy with fallback to app settings."""
        statement = (
            select(CirculationPolicy)
            .options(selectinload(CirculationPolicy.updated_by_user))
            .where(CirculationPolicy.is_active.is_(True))
            .order_by(CirculationPolicy.updated_at.desc())
            .limit(1)
        )
        policy = self.db.execute(statement).scalar_one_or_none()
        if policy is not None:
            return policy

        # Transient fallback instance constructed from settings
        now = datetime.now(UTC)
        return CirculationPolicy(
            id=uuid4(),
            name="Default Policy",
            daily_overdue_fine_rate=settings.DAILY_OVERDUE_FINE_RATE,
            max_fine_amount=settings.MAX_FINE_AMOUNT,
            loan_period_days=settings.LOAN_PERIOD_DAYS,
            max_active_loans=settings.MAX_ACTIVE_LOANS,
            reservation_expiry_days=settings.RESERVATION_EXPIRY_DAYS,
            is_active=True,
            updated_by=None,
            created_at=now,
            updated_at=now,
        )

    def update_active(
        self,
        payload: CirculationPolicyUpdate,
        updated_by_id: UUID,
    ) -> CirculationPolicy:
        """Update or create the active circulation policy with administrator audit tracking."""
        statement = (
            select(CirculationPolicy)
            .where(CirculationPolicy.is_active.is_(True))
            .order_by(CirculationPolicy.updated_at.desc())
            .with_for_update()
            .limit(1)
        )
        policy = self.db.execute(statement).scalar_one_or_none()
        now = datetime.now(UTC)

        if policy is None:
            policy = CirculationPolicy(
                name="Default Policy",
                daily_overdue_fine_rate=payload.daily_overdue_fine_rate,
                max_fine_amount=payload.max_fine_amount,
                loan_period_days=payload.loan_period_days,
                max_active_loans=payload.max_active_loans,
                reservation_expiry_days=payload.reservation_expiry_days,
                is_active=True,
                updated_by=updated_by_id,
            )
            self.db.add(policy)
        else:
            policy.daily_overdue_fine_rate = payload.daily_overdue_fine_rate
            policy.max_fine_amount = payload.max_fine_amount
            policy.loan_period_days = payload.loan_period_days
            policy.max_active_loans = payload.max_active_loans
            policy.reservation_expiry_days = payload.reservation_expiry_days
            policy.updated_by = updated_by_id
            policy.updated_at = now

        self.db.commit()

        # Re-fetch with loaded relationship
        return self.get_active()
