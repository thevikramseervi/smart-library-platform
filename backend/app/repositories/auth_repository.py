"""Authentication repository for user lookups."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.user import User


class AuthRepository:
    """Database access for authentication-related user queries."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        """Fetch a non-deleted user by email with role and department."""
        statement = (
            select(User)
            .options(selectinload(User.role), selectinload(User.department))
            .where(User.email == email, User.deleted_at.is_(None))
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_id(self, user_id: UUID) -> User | None:
        """Fetch a non-deleted user by id with role and department."""
        statement = (
            select(User)
            .options(selectinload(User.role), selectinload(User.department))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        return self.db.execute(statement).scalar_one_or_none()
