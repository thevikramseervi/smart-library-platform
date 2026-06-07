"""Fine schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FineResponse(BaseModel):
    """Fine details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transaction_id: UUID
    amount: Decimal
    reason: str
    paid: bool
    paid_at: datetime | None
    created_at: datetime
