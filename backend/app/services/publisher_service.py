"""Publisher business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.publisher import Publisher
from app.repositories.publisher_repository import PublisherRepository
from app.schemas.publisher import PublisherCreate, PublisherResponse, PublisherUpdate


class PublisherService:
    """Service layer for publisher management."""

    def __init__(self, db: Session) -> None:
        self.repository = PublisherRepository(db)
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

    def create_publisher(self, payload: PublisherCreate) -> PublisherResponse:
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
        self.db.commit()
        self.db.refresh(created)
        return PublisherResponse.model_validate(created)

    def update_publisher(self, publisher_id: UUID, payload: PublisherUpdate) -> PublisherResponse:
        """Update an active publisher."""
        publisher = self.repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publisher not found")

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

        self.db.commit()
        self.db.refresh(publisher)
        return PublisherResponse.model_validate(publisher)

    def delete_publisher(self, publisher_id: UUID) -> None:
        """Soft delete a publisher."""
        publisher = self.repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publisher not found")
        self.repository.soft_delete(publisher)
        self.db.commit()
