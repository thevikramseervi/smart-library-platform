"""Book copy request and response schemas."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.book_copy import BookCopyStatus


class BookCopyCreate(BaseModel):
    """Payload for creating a book copy."""

    book_id: UUID
    inventory_code: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=100)
    status: BookCopyStatus = BookCopyStatus.AVAILABLE
    acquired_date: date | None = None


class BookCopyUpdate(BaseModel):
    """Payload for updating a book copy."""

    location: str | None = Field(default=None, max_length=100)
    status: BookCopyStatus | None = None
    acquired_date: date | None = None


class BookCopyResponse(BaseModel):
    """Book copy details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    book_id: UUID
    inventory_code: str
    qr_code_value: str
    location: str | None
    status: BookCopyStatus
    acquired_date: date | None
