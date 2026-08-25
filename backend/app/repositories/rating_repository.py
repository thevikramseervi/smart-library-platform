"""Rating repository."""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.rating import Rating


class RatingRepository:
    """Database access for book ratings."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_for_student_book(self, student_id: UUID, book_id: UUID) -> Rating | None:
        """Fetch the caller's rating for a book."""
        statement = select(Rating).where(
            Rating.student_id == student_id,
            Rating.book_id == book_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def upsert(self, *, student_id: UUID, book_id: UUID, score: int) -> Rating:
        """Create or update a rating atomically via ON CONFLICT."""
        statement = (
            pg_insert(Rating)
            .values(student_id=student_id, book_id=book_id, score=score)
            .on_conflict_do_update(
                constraint="uq_ratings_book_student",
                set_={"score": score},
            )
            .returning(Rating)
        )
        return self.db.execute(statement).scalar_one()

    def delete_for_student_book(self, student_id: UUID, book_id: UUID) -> int:
        """Remove the caller's rating; returns rows deleted."""
        statement = delete(Rating).where(
            Rating.student_id == student_id,
            Rating.book_id == book_id,
        )
        result = self.db.execute(statement)
        return result.rowcount

    def summary(self, book_id: UUID) -> tuple[float | None, int]:
        """Return (average, count) for a book."""
        statement = select(func.avg(Rating.score), func.count()).where(
            Rating.book_id == book_id
        )
        average, count = self.db.execute(statement).one()
        return (float(average) if average is not None else None), int(count)
