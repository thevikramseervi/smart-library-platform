"""Author request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuthorCreate(BaseModel):
    """Payload for creating an author."""

    name: str = Field(min_length=1, max_length=255)
    bio: str | None = None


class AuthorUpdate(BaseModel):
    """Payload for updating an author."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = None


class AuthorResponse(BaseModel):
    """Author details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    bio: str | None
