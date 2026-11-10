"""Student feedback used to personalize book recommendations."""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class RecommendationFeedback(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A student's explicit preference for a catalog title."""

    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        CheckConstraint(
            "signal IN ('LIKE', 'DISMISS')",
            name="ck_recommendation_feedback_signal",
        ),
        UniqueConstraint("student_id", "book_id", name="uq_recommendation_feedback_student_book"),
        Index("ix_recommendation_feedback_book_id", "book_id"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    signal: Mapped[str] = mapped_column(String(10), nullable=False)
