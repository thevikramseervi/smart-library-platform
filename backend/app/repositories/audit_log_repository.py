"""Database access for immutable audit events."""

from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.sql import contains_pattern
from app.models.audit_log import AuditLog


class AuditLogRepository:
    """Query audit events with admin-facing filters and pagination."""

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _date_bounds(
        start_date: date | None, end_date: date | None
    ) -> tuple[datetime | None, datetime | None]:
        start = datetime.combine(start_date, time.min, tzinfo=UTC) if start_date else None
        end = (
            datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=UTC)
            if end_date
            else None
        )
        return start, end

    def list_events(
        self,
        *,
        page: int,
        page_size: int,
        action: str | None = None,
        q: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[AuditLog], int]:
        start, end = self._date_bounds(start_date, end_date)
        conditions = []
        if action:
            conditions.append(AuditLog.action == action)
        if start:
            conditions.append(AuditLog.occurred_at >= start)
        if end:
            conditions.append(AuditLog.occurred_at < end)
        if q:
            pattern = contains_pattern(q)
            conditions.append(
                or_(
                    AuditLog.actor_name.ilike(pattern),
                    AuditLog.actor_email.ilike(pattern),
                    AuditLog.summary.ilike(pattern),
                    AuditLog.entity_type.ilike(pattern),
                    AuditLog.entity_id.ilike(pattern),
                    cast(AuditLog.details, Text).ilike(pattern),
                )
            )

        total = int(
            self.db.execute(
                select(func.count(AuditLog.id)).where(*conditions)
            ).scalar_one()
        )
        statement = (
            select(AuditLog)
            .where(*conditions)
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(statement).scalars().all()), total
