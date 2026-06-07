"""Publisher request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PublisherCreate(BaseModel):
    """Payload for creating a publisher."""

    name: str = Field(min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)


class PublisherUpdate(BaseModel):
    """Payload for updating a publisher."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)


class PublisherResponse(BaseModel):
    """Publisher details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    website: str | None
    country: str | None
