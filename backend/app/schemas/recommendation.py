"""Book recommendation response schemas."""

from pydantic import BaseModel

from app.schemas.book import BookResponse


class BookRecommendationResponse(BaseModel):
    """A catalog book with a short explanation for its recommendation."""

    book: BookResponse
    reason: str
