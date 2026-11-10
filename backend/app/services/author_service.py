"""Author business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.author import Author
from app.models.user import User
from app.repositories.author_repository import AuthorRepository
from app.schemas.author import AuthorCreate, AuthorResponse, AuthorUpdate
from app.services.audit_log_service import AuditLogService
from app.services.embedding_service import EmbeddingService


class AuthorService:
    """Service layer for author management."""

    def __init__(self, db: Session) -> None:
        self.repository = AuthorRepository(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db

    def list_authors(self) -> list[AuthorResponse]:
        """Return all active authors."""
        authors = self.repository.list_active()
        return [AuthorResponse.model_validate(author) for author in authors]

    def get_author(self, author_id: UUID) -> AuthorResponse:
        """Return an author by id."""
        author = self.repository.get_active_by_id(author_id)
        if author is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
        return AuthorResponse.model_validate(author)

    def create_author(self, payload: AuthorCreate, actor: User) -> AuthorResponse:
        """Create an author."""
        author = Author(name=payload.name, bio=payload.bio)
        created = self.repository.create(author)
        self.audit_log_service.record(
            actor=actor,
            action="AUTHOR_CREATED",
            entity_type="AUTHOR",
            entity_id=created.id,
            summary=f'Created author "{created.name}"',
            details={"name": created.name, "bio": created.bio},
        )
        self.db.commit()
        self.db.refresh(created)
        return AuthorResponse.model_validate(created)

    def update_author(
        self,
        author_id: UUID,
        payload: AuthorUpdate,
        *,
        actor: User,
    ) -> tuple[AuthorResponse, list[UUID]]:
        """Update an active author."""
        author = self.repository.get_active_by_id(author_id)
        if author is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")

        before = {"name": author.name, "bio": author.bio}

        affected_book_ids = (
            self.repository.list_active_book_ids(author_id)
            if payload.name is not None and payload.name != author.name
            else []
        )
        if payload.name is not None:
            author.name = payload.name
        if payload.bio is not None:
            author.bio = payload.bio

        after = {"name": author.name, "bio": author.bio}
        changes = {
            key: {"before": before[key], "after": after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            self.audit_log_service.record(
                actor=actor,
                action="AUTHOR_UPDATED",
                entity_type="AUTHOR",
                entity_id=author.id,
                summary=f'Updated author "{author.name}"',
                details={"changes": changes},
            )

        if affected_book_ids:
            EmbeddingService(self.db).mark_books_pending(affected_book_ids)
        self.db.commit()
        self.db.refresh(author)
        return AuthorResponse.model_validate(author), affected_book_ids

    def delete_author(self, author_id: UUID, actor: User) -> list[UUID]:
        """Soft delete an author."""
        author = self.repository.get_active_by_id(author_id)
        if author is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
        affected_book_ids = self.repository.list_active_book_ids(author_id)
        self.repository.soft_delete(author)
        if affected_book_ids:
            EmbeddingService(self.db).mark_books_pending(affected_book_ids)
        self.audit_log_service.record(
            actor=actor,
            action="AUTHOR_DELETED",
            entity_type="AUTHOR",
            entity_id=author.id,
            summary=f'Marked author "{author.name}" as deleted',
            details={"name": author.name, "bio": author.bio},
        )
        self.db.commit()
        return affected_book_ids
