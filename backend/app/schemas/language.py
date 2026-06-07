"""Language request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LanguageCreate(BaseModel):
    """Payload for creating a language."""

    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=20)


class LanguageResponse(BaseModel):
    """Language details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
