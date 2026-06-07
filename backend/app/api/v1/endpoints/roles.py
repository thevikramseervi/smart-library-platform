"""Role endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.auth import RoleResponse
from app.services.role_service import RoleService

router = APIRouter()


def get_role_service(db: Session = Depends(get_db)) -> RoleService:
    """Provide a RoleService for the current request."""
    return RoleService(db)


@router.get("", response_model=list[RoleResponse])
def list_roles(
    _current_user: User = Depends(require_roles("ADMIN")),
    service: RoleService = Depends(get_role_service),
) -> list[RoleResponse]:
    """List all roles for admin forms."""
    return service.list_roles()
