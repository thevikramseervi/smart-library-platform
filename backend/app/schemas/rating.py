"""Rating schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RatingUpsert(BaseModel):
    """Payload for creating or updating the caller's rating."""

    score: int = Field(ge=1, le=5)


class RatingSummaryResponse(BaseModel):
    """Aggregate ratings for a book."""

    book_id: UUID
    average: float | None
    count: int


class ReviewUpsert(BaseModel):
    """Payload for creating or editing written feedback on a rated book."""

    review_text: str = Field(min_length=1, max_length=2000)

    @field_validator("review_text")
    @classmethod
    def strip_and_require_text(cls, value: str) -> str:
        """Reject reviews that contain only whitespace."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Review cannot be blank")
        return cleaned


class MyRatingResponse(BaseModel):
    """The authenticated student's own rating for a book."""

    model_config = ConfigDict(from_attributes=True)

    book_id: UUID
    score: int
    review_text: str | None
    updated_at: datetime


class BookReviewResponse(BaseModel):
    """Public review content with a minimal reviewer display name."""

    id: UUID
    score: int
    review_text: str
    reviewer_name: str
    created_at: datetime
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
