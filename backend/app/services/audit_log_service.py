"""Business logic for recording and reading audit events."""

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit_log import AuditLogResponse
from app.schemas.pagination import PaginatedResponse


class AuditLogService:
    """Record important actions inside the transaction that changes the data."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AuditLogRepository(db)

    def record(
        self,
        *,
        actor: User | None,
        action: str,
        entity_type: str,
        entity_id: UUID | str,
        summary: str,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Queue an event for the current transaction; this method never commits."""
        event = AuditLog(
            actor_user_id=actor.id if actor is not None else None,
            actor_name=(f"{actor.first_name} {actor.last_name}".strip() if actor else "System"),
            actor_email=actor.email if actor is not None else "system",
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            summary=summary,
            details=details or {},
        )
        self.db.add(event)
        return event

    def list_events(
        self,
        *,
        page: int,
        page_size: int,
        action: str | None = None,
        q: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> PaginatedResponse[AuditLogResponse]:
        events, total = self.repository.list_events(
            page=page,
            page_size=page_size,
            action=action,
            q=q,
            start_date=start_date,
            end_date=end_date,
        )
        return PaginatedResponse.create(
            [AuditLogResponse.model_validate(event) for event in events],
            total,
            page,
            page_size,
        )
