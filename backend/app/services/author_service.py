"""Author business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.author import Author
from app.repositories.author_repository import AuthorRepository
from app.schemas.author import AuthorCreate, AuthorResponse, AuthorUpdate


class AuthorService:
    """Service layer for author management."""

    def __init__(self, db: Session) -> None:
        self.repository = AuthorRepository(db)
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

    def create_author(self, payload: AuthorCreate) -> AuthorResponse:
        """Create an author."""
        author = Author(name=payload.name, bio=payload.bio)
        created = self.repository.create(author)
        self.db.commit()
        self.db.refresh(created)
        return AuthorResponse.model_validate(created)

    def update_author(self, author_id: UUID, payload: AuthorUpdate) -> AuthorResponse:
        """Update an active author."""
        author = self.repository.get_active_by_id(author_id)
        if author is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")

        if payload.name is not None:
            author.name = payload.name
        if payload.bio is not None:
            author.bio = payload.bio

        self.db.commit()
        self.db.refresh(author)
        return AuthorResponse.model_validate(author)

    def delete_author(self, author_id: UUID) -> None:
        """Soft delete an author."""
        author = self.repository.get_active_by_id(author_id)
        if author is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
        self.repository.soft_delete(author)
        self.db.commit()
