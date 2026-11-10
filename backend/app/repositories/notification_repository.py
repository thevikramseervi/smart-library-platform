"""Database access for in-app notifications."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationRepository:
    """Persist and query notifications scoped to a user."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_once(
        self,
        *,
        user_id: UUID,
        event_key: str,
        notification_type: str,
        title: str,
        message: str,
        link: str | None,
    ) -> None:
        """Create one record per user/event, safely ignoring duplicate events."""
        statement = (
            insert(Notification)
            .values(
                user_id=user_id,
                event_key=event_key,
                notification_type=notification_type,
                title=title,
                message=message,
                link=link,
            )
            .on_conflict_do_nothing(constraint="uq_notifications_user_event_key")
        )
        self.db.execute(statement)

    def create_many_once(self, notifications: list[dict]) -> None:
        """Create multiple events in one statement, ignoring existing events."""
        if not notifications:
            return
        statement = (
            insert(Notification)
            .values(notifications)
            .on_conflict_do_nothing(constraint="uq_notifications_user_event_key")
        )
        self.db.execute(statement)

    def list_for_user(self, user_id: UUID, *, limit: int = 50) -> list[Notification]:
        statement = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).scalars().all())

    def count_unread(self, user_id: UUID) -> int:
        statement = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
        return self.db.execute(statement).scalar_one()

    def get_for_user(self, notification_id: UUID, user_id: UUID) -> Notification | None:
        statement = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def mark_read(self, notification_id: UUID, user_id: UUID) -> None:
        now = datetime.now(UTC)
        statement = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=now, updated_at=now)
        )
        self.db.execute(statement)

    def mark_all_read(self, user_id: UUID) -> None:
        now = datetime.now(UTC)
        statement = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=now, updated_at=now)
        )
        self.db.execute(statement)

    def mark_due_reminders_read(self, user_id: UUID, transaction_id: UUID) -> None:
        now = datetime.now(UTC)
        statement = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.notification_type == "DUE_SOON",
                Notification.event_key.like(f"loan-due:{transaction_id}:%"),
                Notification.read_at.is_(None),
            )
            .values(read_at=now, updated_at=now)
        )
        self.db.execute(statement)
