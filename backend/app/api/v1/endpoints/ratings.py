"""Rating endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.rating import (
    MyRatingResponse,
    RatingSummaryResponse,
    RatingUpsert,
)
from app.services.rating_service import RatingService

router = APIRouter()


def get_rating_service(db: Session = Depends(get_db)) -> RatingService:
    """Provide a RatingService for the current request."""
    return RatingService(db)


@router.get("/books/{book_id}/ratings", response_model=RatingSummaryResponse)
def rating_summary(
    book_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: RatingService = Depends(get_rating_service),
) -> RatingSummaryResponse:
    """Return aggregate ratings for a book."""
    return service.summary(book_id)


@router.get("/books/{book_id}/ratings/me", response_model=MyRatingResponse | None)
def my_rating(
    book_id: UUID,
    current_user: User = Depends(require_roles("STUDENT")),
    service: RatingService = Depends(get_rating_service),
) -> MyRatingResponse | None:
    """Return the caller's own rating for a book, or null."""
    return service.get_my_rating(student=current_user, book_id=book_id)


@router.put("/books/{book_id}/rating", response_model=MyRatingResponse)
def upsert_rating(
    book_id: UUID,
    payload: RatingUpsert,
    current_user: User = Depends(require_roles("STUDENT")),
    service: RatingService = Depends(get_rating_service),
) -> MyRatingResponse:
    """Create or update the caller's rating (1-5)."""
    return service.upsert_rating(student=current_user, book_id=book_id, score=payload.score)


@router.delete("/books/{book_id}/rating", status_code=status.HTTP_204_NO_CONTENT)
def delete_rating(
    book_id: UUID,
    current_user: User = Depends(require_roles("STUDENT")),
    service: RatingService = Depends(get_rating_service),
) -> None:
    """Remove the caller's rating."""
    service.delete_rating(student=current_user, book_id=book_id)
