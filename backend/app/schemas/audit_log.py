"""Audit log API schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    """An immutable audit event returned to an administrator."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    actor_name: str
    actor_email: str
    action: str
    entity_type: str
    entity_id: str
    summary: str
    details: dict[str, Any]
    occurred_at: datetime
