"""Authentication repository for user lookups."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.models.revoked_token import RevokedToken
from app.models.user import User


class AuthRepository:
    """Database access for authentication-related user queries."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def is_revoked(self, digest: str) -> bool:
        return self.db.get(RevokedToken, digest) is not None

    def revoke(self, digest: str, expires_at: datetime) -> None:
        self.db.execute(delete(RevokedToken).where(RevokedToken.expires_at <= datetime.now(UTC)))
        self.db.execute(
            insert(RevokedToken).values(digest=digest, expires_at=expires_at)
            .on_conflict_do_nothing(index_elements=[RevokedToken.digest])
        )

    def get_by_email(self, email: str) -> User | None:
        """Fetch a non-deleted user by email with role and department."""
        statement = (
            select(User)
            .options(joinedload(User.role), joinedload(User.department))
            .where(User.email == email, User.deleted_at.is_(None))
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_id(self, user_id: UUID) -> User | None:
        """Fetch a non-deleted user by id with role and department."""
        statement = (
            select(User)
            .options(joinedload(User.role), joinedload(User.department))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        return self.db.execute(statement).scalar_one_or_none()
