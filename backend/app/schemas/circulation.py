"""Circulation helper schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.book_copy import BookCopyStatus


class StudentSearchResult(BaseModel):
    """Student summary for circulation issue UI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str
    student_code: str | None


class AvailableCopyResult(BaseModel):
    """Available copy summary for circulation issue UI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_code: str
    book_id: UUID
    book_title: str
    location: str | None


class CopyLookupResult(AvailableCopyResult):
    """Copy details and circulation status for staff QR lookup."""

    status: BookCopyStatus
