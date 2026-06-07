"""User repository for admin management."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.role import Role
from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Database access for user administration."""

    def __init__(self, db: Session) -> None:
        super().__init__(User, db)

    def _with_relations(self):
        """Base select with eager-loaded role and department."""
        return select(User).options(
            selectinload(User.role),
            selectinload(User.department),
        )

    def get_by_id_with_relations(self, user_id: UUID) -> User | None:
        """Fetch a non-deleted user with role and department."""
        statement = self._with_relations().where(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_email(self, email: str, *, exclude_id: UUID | None = None) -> User | None:
        """Fetch a non-deleted user by email."""
        statement = select(User).where(User.email == email, User.deleted_at.is_(None))
        if exclude_id is not None:
            statement = statement.where(User.id != exclude_id)
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_student_code(
        self,
        student_code: str,
        *,
        exclude_id: UUID | None = None,
    ) -> User | None:
        """Fetch a non-deleted user by student code."""
        statement = select(User).where(
            User.student_code == student_code,
            User.deleted_at.is_(None),
        )
        if exclude_id is not None:
            statement = statement.where(User.id != exclude_id)
        return self.db.execute(statement).scalar_one_or_none()

    def list_users(
        self,
        *,
        page: int,
        page_size: int,
        q: str | None = None,
        role_name: str | None = None,
        department_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[User], int]:
        """Return paginated non-deleted users with optional filters."""
        filters = [User.deleted_at.is_(None)]
        if role_name is not None:
            filters.append(Role.name == role_name)
        if department_id is not None:
            filters.append(User.department_id == department_id)
        if is_active is not None:
            filters.append(User.is_active.is_(is_active))
        if q:
            pattern = f"%{q.strip()}%"
            filters.append(
                or_(
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    User.student_code.ilike(pattern),
                )
            )

        count_statement = select(func.count()).select_from(User).join(Role, User.role_id == Role.id)
        for condition in filters:
            count_statement = count_statement.where(condition)
        total = int(self.db.execute(count_statement).scalar_one())

        statement = self._with_relations().join(Role, User.role_id == Role.id)
        for condition in filters:
            statement = statement.where(condition)
        statement = (
            statement.order_by(User.last_name, User.first_name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).scalars().all())
        return items, total

    def count_active_admins(self, *, exclude_id: UUID | None = None) -> int:
        """Count active, non-deleted admin users."""
        statement = (
            select(func.count())
            .select_from(User)
            .join(Role, User.role_id == Role.id)
            .where(
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                Role.name == "ADMIN",
            )
        )
        if exclude_id is not None:
            statement = statement.where(User.id != exclude_id)
        return int(self.db.execute(statement).scalar_one())

    def create(self, user: User) -> User:
        """Persist a new user."""
        self.db.add(user)
        self.db.flush()
        return user
