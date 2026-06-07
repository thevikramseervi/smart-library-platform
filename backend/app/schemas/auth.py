"""Authentication request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Credentials for user login."""

    email: str
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """JWT access token response."""

    access_token: str
    token_type: str = "bearer"


class RoleResponse(BaseModel):
    """Role details from the roles table."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class DepartmentResponse(BaseModel):
    """Department details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    description: str | None = None


class UserResponse(BaseModel):
    """Authenticated user profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    student_code: str | None
    semester: int | None
    is_active: bool
    role: RoleResponse
    department: DepartmentResponse | None
