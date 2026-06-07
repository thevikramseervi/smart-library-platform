"""Book database model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.author import Author
    from app.models.book_copy import BookCopy
    from app.models.category import Category
    from app.models.language import Language
    from app.models.publisher import Publisher
    from app.models.reservation import Reservation


class Book(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Library catalog book."""

    __tablename__ = "books"

    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    isbn: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)
    publisher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("publishers.id"),
        nullable=False,
    )
    language_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("languages.id"),
        nullable=False,
    )
    edition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_digital: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    publisher: Mapped["Publisher"] = relationship("Publisher", back_populates="books")
    language: Mapped["Language"] = relationship("Language", back_populates="books")
    authors: Mapped[list["Author"]] = relationship(
        "Author",
        secondary="book_authors",
        back_populates="books",
    )
    categories: Mapped[list["Category"]] = relationship(
        "Category",
        secondary="book_categories",
        back_populates="books",
    )
    copies: Mapped[list["BookCopy"]] = relationship("BookCopy", back_populates="book")
    reservations: Mapped[list["Reservation"]] = relationship("Reservation", back_populates="book")
