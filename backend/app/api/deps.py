"""Shared API dependencies."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

security = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Provide an AuthService instance for the current request."""
    return AuthService(db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Return the authenticated user from a Bearer JWT."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return auth_service.authenticate_token(credentials.credentials)


def require_roles(*allowed_role_names: str) -> Callable[..., User]:
    """Require the current user's roles.name to match one of the allowed values.

    The roles table is the source of truth. allowed_role_names must match
    roles.name values seeded in the database (e.g. "ADMIN", "LIBRARIAN", "STUDENT").
    """

    def role_checker(
        current_user: User = Depends(get_current_user),
        auth_service: AuthService = Depends(get_auth_service),
    ) -> User:
        auth_service.ensure_user_has_role(current_user, *allowed_role_names)
        return current_user

    return role_checker


__all__ = ["get_auth_service", "get_current_user", "get_db", "require_roles"]
