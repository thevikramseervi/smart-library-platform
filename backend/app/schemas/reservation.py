"""Reservation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReservationCreate(BaseModel):
    """Payload for creating a book reservation."""

    book_id: UUID


class ReservationBookSummary(BaseModel):
    """Minimal book details on a reservation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str


class ReservationStudentSummary(BaseModel):
    """Student details for reservation queue display."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    student_code: str | None


class ReservationResponse(BaseModel):
    """Reservation with computed queue position."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    book_id: UUID
    reservation_date: datetime
    expiry_date: datetime
    status: str
    queue_position: int | None = None
    book: ReservationBookSummary
    student: ReservationStudentSummary
