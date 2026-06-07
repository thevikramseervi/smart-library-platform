"""Admin user management request schemas."""

from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class UserCreate(BaseModel):
    """Payload for creating a user."""

    role_id: UUID
    department_id: UUID | None = None
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    student_code: str | None = Field(default=None, max_length=100)
    semester: int | None = Field(default=None, ge=1)
    is_active: bool = True


class UserUpdate(BaseModel):
    """Payload for updating a user."""

    role_id: UUID | None = None
    department_id: UUID | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    student_code: str | None = Field(default=None, max_length=100)
    semester: int | None = Field(default=None, ge=1)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self) -> "UserUpdate":
        """Ensure the update payload is not empty."""
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class UserPasswordReset(BaseModel):
    """Payload for admin password reset."""

    password: str = Field(min_length=8, max_length=128)
