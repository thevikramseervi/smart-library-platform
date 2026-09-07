"""Circulation policy schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PolicyUserSummary(BaseModel):
    """Minimal user summary for policy audit."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str


class CirculationPolicyResponse(BaseModel):
    """Circulation policy response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    daily_overdue_fine_rate: Decimal
    max_fine_amount: Decimal
    loan_period_days: int
    max_active_loans: int
    reservation_expiry_days: int
    is_active: bool
    updated_by: UUID | None = None
    updated_by_user: PolicyUserSummary | None = None
    created_at: datetime
    updated_at: datetime


class CirculationPolicyUpdate(BaseModel):
    """Schema for updating active circulation policy."""

    daily_overdue_fine_rate: Decimal = Field(
        ...,
        ge=0,
        description="Daily overdue fine rate in INR",
    )
    max_fine_amount: Decimal = Field(
        ...,
        ge=0,
        description="Maximum fine cap in INR",
    )
    loan_period_days: int = Field(
        ...,
        ge=1,
        le=365,
        description="Standard loan duration in days",
    )
    max_active_loans: int = Field(
        ...,
        ge=1,
        le=50,
        description="Maximum concurrent active loans per student",
    )
    reservation_expiry_days: int = Field(
        ...,
        ge=1,
        le=90,
        description="Reservation hold expiry in days",
    )

    @model_validator(mode="after")
    def validate_fine_cap(self) -> "CirculationPolicyUpdate":
        """Ensure the maximum fine amount is not less than the single-day fine rate."""
        if self.daily_overdue_fine_rate > 0 and self.max_fine_amount < self.daily_overdue_fine_rate:
            raise ValueError(
                "max_fine_amount cannot be less than daily_overdue_fine_rate when fine rate is positive"
            )
        return self
