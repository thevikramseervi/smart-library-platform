"""Circulation policy database model."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class CirculationPolicy(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Dynamic circulation policy configuration."""

    __tablename__ = "circulation_policies"
    __table_args__ = (
        CheckConstraint(
            "max_renewals BETWEEN 0 AND 5",
            name="ck_circulation_policies_max_renewals_range",
        ),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Default Policy")
    daily_overdue_fine_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("10.00")
    )
    max_fine_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("500.00")
    )
    loan_period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    max_active_loans: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    max_renewals: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
    )
    reservation_expiry_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by_user: Mapped["User | None"] = relationship("User")
