"""Private PDF resource attached to a catalog book."""

import uuid

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class DigitalResource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Metadata for the single stored PDF associated with a book."""

    __tablename__ = "digital_resources"
    __table_args__ = (
        UniqueConstraint("book_id", name="uq_digital_resources_book_id"),
        CheckConstraint("file_size > 0", name="ck_digital_resources_file_size_positive"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
