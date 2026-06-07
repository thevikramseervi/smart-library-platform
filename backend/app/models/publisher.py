"""Publisher database model."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.book import Book


class Publisher(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Book publisher."""

    __tablename__ = "publishers"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    books: Mapped[list["Book"]] = relationship("Book", back_populates="publisher")
