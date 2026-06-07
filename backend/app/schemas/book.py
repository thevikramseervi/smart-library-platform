"""Book request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.author import AuthorResponse
from app.schemas.category import CategoryResponse
from app.schemas.language import LanguageResponse
from app.schemas.publisher import PublisherResponse


class BookCreate(BaseModel):
    """Payload for creating a book."""

    title: str = Field(min_length=1, max_length=500)
    isbn: str | None = Field(default=None, max_length=50)
    publisher_id: UUID
    language_id: UUID
    edition: str | None = Field(default=None, max_length=50)
    publication_year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    is_digital: bool = False
    author_ids: list[UUID] = Field(default_factory=list)
    category_ids: list[UUID] = Field(default_factory=list)


class BookUpdate(BaseModel):
    """Payload for updating a book."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    isbn: str | None = Field(default=None, max_length=50)
    publisher_id: UUID | None = None
    language_id: UUID | None = None
    edition: str | None = Field(default=None, max_length=50)
    publication_year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    is_digital: bool | None = None
    author_ids: list[UUID] | None = None
    category_ids: list[UUID] | None = None


class BookResponse(BaseModel):
    """Book details with copy aggregates."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    isbn: str | None
    publisher_id: UUID
    language_id: UUID
    edition: str | None
    publication_year: int | None
    description: str | None
    cover_image_url: str | None
    is_digital: bool
    publisher: PublisherResponse
    language: LanguageResponse
    authors: list[AuthorResponse]
    categories: list[CategoryResponse]
    copy_count: int
    total_copies: int
    available_copies: int
