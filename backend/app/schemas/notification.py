"""Notification API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    """A notification visible to the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    notification_type: str
    title: str
    message: str
    link: str | None
    created_at: datetime
    read_at: datetime | None


class NotificationCenterResponse(BaseModel):
    """Recent notifications and unread count for the current user."""

    items: list[NotificationResponse]
    unread_count: int
