"""Rating business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.rating_repository import RatingRepository
from app.schemas.pagination import PaginatedResponse
from app.schemas.rating import (
    BookReviewResponse,
    MyRatingResponse,
    RatingSummaryResponse,
)


class RatingService:
    """Service layer for book ratings."""

    def __init__(self, db: Session) -> None:
        self.repository = RatingRepository(db)
        self.db = db

    def _ensure_book_active(self, book_id: UUID) -> None:
        from app.repositories.circulation_repository import CirculationRepository

        if CirculationRepository(self.db).get_active_book(book_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    def upsert_rating(
        self,
        *,
        student: User,
        book_id: UUID,
        score: int,
    ) -> MyRatingResponse:
        """Create or update the student's rating for a book."""
        self._ensure_book_active(book_id)
        rating = self.repository.upsert(student_id=student.id, book_id=book_id, score=score)
        self.db.commit()
        self.db.refresh(rating)
        return MyRatingResponse.model_validate(rating)

    def delete_rating(self, *, student: User, book_id: UUID) -> None:
        """Remove the student's rating; 404 when none exists."""
        deleted = self.repository.delete_for_student_book(student.id, book_id)
        if deleted == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rating not found")
        self.db.commit()

    def upsert_review(self, *, student: User, book_id: UUID, review_text: str) -> MyRatingResponse:
        """Save a review on the student's existing rating."""
        self._ensure_book_active(book_id)
        rating = self.repository.get_for_student_book(student.id, book_id)
        if rating is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Rate this book before writing a review",
            )
        rating.review_text = review_text
        self.db.commit()
        self.db.refresh(rating)
        return MyRatingResponse.model_validate(rating)

    def delete_review(self, *, student: User, book_id: UUID) -> None:
        """Remove the student's review while keeping their star rating."""
        rating = self.repository.get_for_student_book(student.id, book_id)
        if rating is None or rating.review_text is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        rating.review_text = None
        self.db.commit()

    def list_reviews(
        self, *, book_id: UUID, page: int, page_size: int
    ) -> PaginatedResponse[BookReviewResponse]:
        """List the written reviews for an active catalog book."""
        self._ensure_book_active(book_id)
        reviews, total = self.repository.list_reviews(
            book_id=book_id,
            page=page,
            page_size=page_size,
        )
        items = [
            BookReviewResponse(
                id=rating.id,
                score=rating.score,
                review_text=rating.review_text or "",
                reviewer_name=(
                    f"{rating.student.first_name} {rating.student.last_name[0]}."
                    if rating.student.last_name
                    else rating.student.first_name
                ),
                created_at=rating.created_at,
                updated_at=rating.updated_at,
            )
            for rating in reviews
        ]
        return PaginatedResponse.create(items, total, page, page_size)

    def get_my_rating(self, *, student: User, book_id: UUID) -> MyRatingResponse | None:
        """Return the student's own rating or None."""
        rating = self.repository.get_for_student_book(student.id, book_id)
        return MyRatingResponse.model_validate(rating) if rating else None

    def summary(self, book_id: UUID) -> RatingSummaryResponse:
        """Return aggregate ratings; 404 when the book does not exist."""
        self._ensure_book_active(book_id)
        average, count = self.repository.summary(book_id)
        return RatingSummaryResponse(book_id=book_id, average=average, count=count)
