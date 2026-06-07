"""Department repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.user import User
from app.repositories.base import BaseRepository


class DepartmentRepository(BaseRepository[Department]):
    """Database access for departments."""

    def __init__(self, db: Session) -> None:
        super().__init__(Department, db)

    def list_all(self) -> list[Department]:
        """Return all departments ordered by code."""
        statement = select(Department).order_by(Department.code)
        return list(self.db.execute(statement).scalars().all())

    def get_by_id(self, department_id: UUID) -> Department | None:
        """Fetch a department by id."""
        return self.db.get(Department, department_id)

    def get_by_code(self, code: str, *, exclude_id: UUID | None = None) -> Department | None:
        """Fetch a department by unique code."""
        statement = select(Department).where(Department.code == code)
        if exclude_id is not None:
            statement = statement.where(Department.id != exclude_id)
        return self.db.execute(statement).scalar_one_or_none()

    def count_users(self, department_id: UUID) -> int:
        """Count non-deleted users assigned to a department."""
        statement = (
            select(func.count())
            .select_from(User)
            .where(User.department_id == department_id, User.deleted_at.is_(None))
        )
        return int(self.db.execute(statement).scalar_one())

    def create(self, department: Department) -> Department:
        """Persist a new department."""
        self.db.add(department)
        self.db.flush()
        return department

    def delete(self, department: Department) -> None:
        """Hard delete a department."""
        self.db.delete(department)
