"""Publisher business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.publisher import Publisher
from app.models.user import User
from app.repositories.publisher_repository import PublisherRepository
from app.schemas.publisher import PublisherCreate, PublisherResponse, PublisherUpdate
from app.services.audit_log_service import AuditLogService
from app.services.embedding_service import EmbeddingService


class PublisherService:
    """Service layer for publisher management."""

    def __init__(self, db: Session) -> None:
        self.repository = PublisherRepository(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db

    def list_publishers(self) -> list[PublisherResponse]:
        """Return all active publishers."""
        publishers = self.repository.list_active()
        return [PublisherResponse.model_validate(pub) for pub in publishers]

    def get_publisher(self, publisher_id: UUID) -> PublisherResponse:
        """Return a publisher by id."""
        publisher = self.repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publisher not found")
        return PublisherResponse.model_validate(publisher)

    def create_publisher(self, payload: PublisherCreate, actor: User) -> PublisherResponse:
        """Create a publisher with unique name."""
        if self.repository.get_by_name(payload.name, active_only=False) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Publisher name already exists",
            )

        publisher = Publisher(
            name=payload.name,
            website=payload.website,
            country=payload.country,
        )
        created = self.repository.create(publisher)
        self.audit_log_service.record(
            actor=actor,
            action="PUBLISHER_CREATED",
            entity_type="PUBLISHER",
            entity_id=created.id,
            summary=f'Created publisher "{created.name}"',
            details={"name": created.name, "website": created.website, "country": created.country},
        )
        self.db.commit()
        self.db.refresh(created)
        return PublisherResponse.model_validate(created)

    def update_publisher(
        self,
        publisher_id: UUID,
        payload: PublisherUpdate,
        *,
        actor: User,
    ) -> tuple[PublisherResponse, list[UUID]]:
        """Update an active publisher."""
        publisher = self.repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publisher not found")

        before = {
            "name": publisher.name,
            "website": publisher.website,
            "country": publisher.country,
        }

        affected_book_ids = (
            self.repository.list_active_book_ids(publisher_id)
            if payload.name is not None and payload.name != publisher.name
            else []
        )
        if payload.name is not None and payload.name != publisher.name:
            existing = self.repository.get_by_name(payload.name, active_only=False)
            if existing is not None and existing.id != publisher.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Publisher name already exists",
                )
            publisher.name = payload.name

        if payload.website is not None:
            publisher.website = payload.website
        if payload.country is not None:
            publisher.country = payload.country

        after = {
            "name": publisher.name,
            "website": publisher.website,
            "country": publisher.country,
        }
        changes = {
            key: {"before": before[key], "after": after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            self.audit_log_service.record(
                actor=actor,
                action="PUBLISHER_UPDATED",
                entity_type="PUBLISHER",
                entity_id=publisher.id,
                summary=f'Updated publisher "{publisher.name}"',
                details={"changes": changes},
            )

        if affected_book_ids:
            EmbeddingService(self.db).mark_books_pending(affected_book_ids)
        self.db.commit()
        self.db.refresh(publisher)
        return PublisherResponse.model_validate(publisher), affected_book_ids

    def delete_publisher(self, publisher_id: UUID, actor: User) -> list[UUID]:
        """Soft delete a publisher."""
        publisher = self.repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publisher not found")
        affected_book_ids = self.repository.list_active_book_ids(publisher_id)
        self.repository.soft_delete(publisher)
        if affected_book_ids:
            EmbeddingService(self.db).mark_books_pending(affected_book_ids)
        self.audit_log_service.record(
            actor=actor,
            action="PUBLISHER_DELETED",
            entity_type="PUBLISHER",
            entity_id=publisher.id,
            summary=f'Marked publisher "{publisher.name}" as deleted',
            details={
                "name": publisher.name,
                "website": publisher.website,
                "country": publisher.country,
            },
        )
        self.db.commit()
        return affected_book_ids
