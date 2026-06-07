"""Language database model."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.book import Book


class Language(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Book language (e.g. English, Hindi)."""

    __tablename__ = "languages"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    books: Mapped[list["Book"]] = relationship("Book", back_populates="language")
