"""Book copy database model."""

from __future__ import annotations

import enum
import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.transaction import Transaction


class BookCopyStatus(str, enum.Enum):
    """Physical copy circulation status."""

    AVAILABLE = "AVAILABLE"
    BORROWED = "BORROWED"
    RESERVED = "RESERVED"
    LOST = "LOST"
    DAMAGED = "DAMAGED"
    RETIRED = "RETIRED"


class BookCopy(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Physical inventory copy of a book."""

    __tablename__ = "book_copies"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id"),
        nullable=False,
    )
    inventory_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    qr_code_value: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[BookCopyStatus] = mapped_column(
        Enum(BookCopyStatus, name="bookcopystatus", create_type=False),
        nullable=False,
        default=BookCopyStatus.AVAILABLE,
        server_default=BookCopyStatus.AVAILABLE.value,
    )
    acquired_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    book: Mapped["Book"] = relationship("Book", back_populates="copies")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="book_copy")
