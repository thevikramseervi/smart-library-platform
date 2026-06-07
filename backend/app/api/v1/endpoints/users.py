"""Admin user management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.pagination import PaginatedResponse
from app.schemas.user_admin import UserCreate, UserPasswordReset, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    """Provide a UserService for the current request."""
    return UserService(db)


@router.get("", response_model=PaginatedResponse[UserResponse])
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    department_id: UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    _current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> PaginatedResponse[UserResponse]:
    """List users with pagination and filters."""
    return service.list_users(
        page=page,
        page_size=page_size,
        q=q,
        role=role,
        department_id=department_id,
        is_active=is_active,
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    """Get a user by id."""
    return service.get_user(user_id)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    """Create a user."""
    return service.create_user(payload)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    """Update a user."""
    return service.update_user(user_id, payload, actor_id=current_user.id)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: UUID,
    payload: UserPasswordReset,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> Response:
    """Reset a user's password."""
    service.reset_password(user_id, payload, actor_id=_current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    service: UserService = Depends(get_user_service),
) -> Response:
    """Soft delete a user."""
    service.deactivate_user(user_id, actor_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
