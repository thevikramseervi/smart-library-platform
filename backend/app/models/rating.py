"""Rating database model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.user import User


class Rating(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A student's 1-5 score for a book; one per student per book."""

    __tablename__ = "ratings"
    __table_args__ = (
        CheckConstraint(
            "score BETWEEN 1 AND 5",
            name="ck_ratings_score_range",
        ),
        CheckConstraint(
            "review_text IS NULL OR length(btrim(review_text)) BETWEEN 1 AND 2000",
            name="ck_ratings_review_text_nonempty",
        ),
        UniqueConstraint("book_id", "student_id", name="uq_ratings_book_student"),
        Index("ix_ratings_book_id", "book_id"),
        Index("ix_ratings_student_id", "student_id"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    book: Mapped["Book"] = relationship("Book", back_populates="ratings")
    student: Mapped["User"] = relationship("User")
