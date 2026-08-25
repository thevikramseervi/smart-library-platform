"""Rating schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RatingUpsert(BaseModel):
    """Payload for creating or updating the caller's rating."""

    score: int = Field(ge=1, le=5)


class RatingSummaryResponse(BaseModel):
    """Aggregate ratings for a book."""

    book_id: UUID
    average: float | None
    count: int


class MyRatingResponse(BaseModel):
    """The authenticated student's own rating for a book."""

    model_config = ConfigDict(from_attributes=True)

    book_id: UUID
    score: int
    updated_at: datetime


class RatingResponse(BaseModel):
    """Full rating record (staff diagnostics)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    book_id: UUID
    student_id: UUID
    score: int
    created_at: datetime
    updated_at: datetime
