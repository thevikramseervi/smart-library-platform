"""Circulation transaction schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TransactionIssueRequest(BaseModel):
    """Payload for issuing a book copy to a student."""

    book_copy_id: UUID | None = None
    student_id: UUID | None = None
    inventory_code: str | None = Field(default=None, max_length=100)
    student_code: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_identifier_pairs(self) -> "TransactionIssueRequest":
        """Require either UUID pair or code pair."""
        has_uuid_pair = self.book_copy_id is not None and self.student_id is not None
        has_code_pair = self.inventory_code is not None and self.student_code is not None
        if has_uuid_pair == has_code_pair:
            raise ValueError(
                "Provide either book_copy_id and student_id, or inventory_code and student_code",
            )
        return self


class TransactionReturnRequest(BaseModel):
    """Payload for returning a borrowed book copy."""

    book_copy_id: UUID | None = None
    inventory_code: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_identifier(self) -> "TransactionReturnRequest":
        """Require exactly one copy identifier."""
        if (self.book_copy_id is None) == (self.inventory_code is None):
            raise ValueError("Provide either book_copy_id or inventory_code")
        return self


class TransactionUserSummary(BaseModel):
    """Minimal user details on a transaction."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str
    student_code: str | None


class TransactionBookSummary(BaseModel):
    """Minimal book details on a transaction."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str


class TransactionCopySummary(BaseModel):
    """Minimal book copy details on a transaction."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_code: str
    book_id: UUID
    book: TransactionBookSummary


class TransactionResponse(BaseModel):
    """Circulation transaction with computed overdue flag."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    book_copy_id: UUID
    student_id: UUID
    issued_by: UUID
    issued_at: datetime
    due_at: date
    returned_at: datetime | None
    status: str
    is_overdue: bool
    book_copy: TransactionCopySummary
    student: TransactionUserSummary
    issuer: TransactionUserSummary
