"""Book recommendation response schemas."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.book import BookResponse


class BookRecommendationResponse(BaseModel):
    """A catalog book with a short explanation for its recommendation."""

    book: BookResponse
    reason: str
    average_rating: float | None = None
    rating_count: int = 0
    feedback_signal: Literal["LIKE", "DISMISS"] | None = None


class RecommendationFeedbackUpsert(BaseModel):
    """Student preference for a recommended title."""

    signal: Literal["LIKE", "DISMISS"]


class RecommendationFeedbackResponse(BaseModel):
    """Saved student preference for a title."""

    book_id: UUID
    signal: Literal["LIKE", "DISMISS"]
