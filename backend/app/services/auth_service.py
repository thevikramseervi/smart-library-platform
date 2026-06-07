"""Authentication business logic."""

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_access_token, verify_password
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)


class AuthService:
    """Service layer for authentication and authorization checks."""

    def __init__(self, db: Session) -> None:
        self.repository = AuthRepository(db)

    def login(self, credentials: LoginRequest) -> TokenResponse:
        """Authenticate a user and return a JWT access token."""
        # TODO: Add login rate limiting and account lockout protection.
        user = self.repository.get_by_email(credentials.email)
        if user is None or not verify_password(credentials.password, user.password_hash):
            logger.info("Failed login attempt for email: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not user.is_active:
            logger.info("Inactive user login attempt: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        access_token = create_access_token(user.id)
        return TokenResponse(access_token=access_token)

    def authenticate_token(self, token: str) -> User:
        """Validate a JWT and return the corresponding active user."""
        try:
            payload = decode_access_token(token)
            user_id = UUID(payload.sub)
        except (ValueError, TypeError) as exc:
            logger.info("Invalid token received")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            ) from exc

        user = self.repository.get_by_id(user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        return user

    def get_user_profile(self, user_id: UUID) -> UserResponse:
        """Return the authenticated user's profile."""
        user = self.repository.get_by_id(user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        return UserResponse.model_validate(user)

    def ensure_user_has_role(self, user: User, *allowed_role_names: str) -> None:
        """Ensure the user's role name (from the roles table) is allowed.

        The roles table is the source of truth for authorization. Role name strings
        passed to this method must match roles.name values in the database.
        """
        if user.role.name not in allowed_role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
