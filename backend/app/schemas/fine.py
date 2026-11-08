"""Fine schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FineResponse(BaseModel):
    """Fine details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transaction_id: UUID
    student_name: str
    student_code: str | None
    book_title: str
    inventory_code: str
    due_at: date
    amount: Decimal
    reason: str
    paid: bool
    paid_at: datetime | None
    created_at: datetime
    is_accruing: bool = False
    is_capped: bool = False
