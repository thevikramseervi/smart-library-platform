"""Digital book resource API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DigitalResourceResponse(BaseModel):
    """Safe metadata exposed to authenticated catalog users."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    book_id: UUID
    original_filename: str
    file_size: int
    created_at: datetime
