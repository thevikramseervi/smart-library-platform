"""Category request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    """Payload for creating a category."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CategoryUpdate(BaseModel):
    """Payload for updating a category."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class CategoryResponse(BaseModel):
    """Category details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
