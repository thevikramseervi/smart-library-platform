"""Transaction database model."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.book_copy import BookCopy
    from app.models.fine import Fine
    from app.models.user import User


class TransactionStatus(str, enum.Enum):
    """Circulation transaction lifecycle status."""

    ISSUED = "ISSUED"
    RETURNED = "RETURNED"


class Transaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Book copy issue/return record."""

    __tablename__ = "transactions"

    book_copy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("book_copies.id"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    issued_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_at: Mapped[date] = mapped_column(Date, nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transactionstatus", create_type=False),
        nullable=False,
    )

    book_copy: Mapped["BookCopy"] = relationship("BookCopy", back_populates="transactions")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    issuer: Mapped["User"] = relationship("User", foreign_keys=[issued_by])
    fine: Mapped["Fine | None"] = relationship("Fine", back_populates="transaction", uselist=False)
