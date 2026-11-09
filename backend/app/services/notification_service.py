"""Notification generation and user-scoped read operations."""

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utc_today
from app.models.book_copy import BookCopy
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import NotificationCenterResponse, NotificationResponse


class NotificationService:
    """Create circulation notifications and expose a user's notification center."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = NotificationRepository(db)

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
        """Add an idempotent notification to the caller's transaction."""
        self.repository.create_once(
            user_id=user_id,
            event_key=event_key,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
        )

    def mark_due_reminders_read(self, user_id: UUID, transaction_id: UUID) -> None:
        """Retire a due reminder when the loan's due date is extended."""
        self.repository.mark_due_reminders_read(user_id, transaction_id)

    def _create_loan_reminders(self, user: User) -> None:
        if user.role.name.upper() != "STUDENT":
            return

        today = utc_today()
        last_reminder_day = today + timedelta(days=3)
        statement = (
            select(Transaction)
            .options(selectinload(Transaction.book_copy).selectinload(BookCopy.book))
            .where(
                Transaction.student_id == user.id,
                Transaction.status == TransactionStatus.ISSUED,
                Transaction.due_at <= last_reminder_day,
            )
        )
        for transaction in self.db.execute(statement).scalars().all():
            book_title = transaction.book_copy.book.title
            if transaction.due_at < today:
                self.create_once(
                    user_id=user.id,
                    event_key=f"loan-overdue:{transaction.id}:{transaction.due_at.isoformat()}",
                    notification_type="LOAN_OVERDUE",
                    title="Book overdue",
                    message=(
                        f"{book_title} is past its due date. Return it soon; "
                        "check My Loans for the current overdue days and fine balance."
                    ),
                    link="/circulation/my-loans",
                )
                continue

            self.create_once(
                user_id=user.id,
                event_key=f"loan-due:{transaction.id}:{transaction.due_at.isoformat()}",
                notification_type="DUE_SOON",
                title="Book due soon",
                message=(
                    f"{book_title} is due on "
                    f"{transaction.due_at.strftime('%d %b %Y')}."
                ),
                link="/circulation/my-loans",
            )

    def list_for_user(self, user: User) -> NotificationCenterResponse:
        """Generate due and overdue loan reminders and return recent notifications."""
        self._create_loan_reminders(user)
        self.db.commit()
        items = self.repository.list_for_user(user.id)
        return NotificationCenterResponse(
            items=[NotificationResponse.model_validate(item) for item in items],
            unread_count=self.repository.count_unread(user.id),
        )

    def mark_read(self, notification_id: UUID, user_id: UUID) -> NotificationResponse:
        """Mark one of the current user's notifications as read."""
        notification = self.repository.get_for_user(notification_id, user_id)
        if notification is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )
        self.repository.mark_read(notification_id, user_id)
        self.db.commit()
        refreshed = self.repository.get_for_user(notification_id, user_id)
        assert refreshed is not None
        return NotificationResponse.model_validate(refreshed)

    def mark_all_read(self, user_id: UUID) -> None:
        """Mark the current user's notifications as read."""
        self.repository.mark_all_read(user_id)
        self.db.commit()
