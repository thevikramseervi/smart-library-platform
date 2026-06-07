"""Role business logic."""

from sqlalchemy.orm import Session

from app.repositories.role_repository import RoleRepository
from app.schemas.auth import RoleResponse


class RoleService:
    """Service layer for role lookups."""

    def __init__(self, db: Session) -> None:
        self.repository = RoleRepository(db)

    def list_roles(self) -> list[RoleResponse]:
        """Return all roles for admin forms."""
        roles = self.repository.list_roles()
        return [RoleResponse.model_validate(role) for role in roles]
