"""Role repository."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.role import Role
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    """Database access for roles."""

    def __init__(self, db: Session) -> None:
        super().__init__(Role, db)

    def list_roles(self) -> list[Role]:
        """Return all roles ordered by name."""
        statement = select(Role).order_by(Role.name)
        return list(self.db.execute(statement).scalars().all())

    def get_by_id(self, role_id) -> Role | None:
        """Fetch a role by primary key."""
        return self.db.get(Role, role_id)
