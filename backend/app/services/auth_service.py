"""Authentication business logic."""

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.rate_limit import login_rate_limiter
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import LoginRequest, PasswordChangeRequest, TokenResponse, UserResponse
from app.services.audit_log_service import AuditLogService

logger = logging.getLogger(__name__)


class AuthService:
    """Service layer for authentication and authorization checks."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AuthRepository(db)
        self.audit_log_service = AuditLogService(db)

    def login(self, credentials: LoginRequest, *, client_ip: str = "unknown") -> TokenResponse:
        """Authenticate a user and return a JWT access token."""
        login_rate_limiter.ensure_not_locked(email=credentials.email, ip=client_ip)
        user = self.repository.get_by_email(credentials.email)
        if user is None or not verify_password(credentials.password, user.password_hash):
            logger.info("Failed login attempt for email: %s", credentials.email)
            login_rate_limiter.record_failure(email=credentials.email, ip=client_ip)
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

        login_rate_limiter.record_success(email=credentials.email)
        access_token = create_access_token(user.id, token_version=user.token_version)
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
        if payload.ver != user.token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked; please sign in again",
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

    def change_password(
        self,
        user: User,
        payload: PasswordChangeRequest,
    ) -> TokenResponse:
        """Change a user's password, revoke old sessions, and return a replacement token."""
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        if verify_password(payload.new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="New password must be different from the current password",
            )

        user.password_hash = hash_password(payload.new_password)
        user.token_version = (user.token_version or 0) + 1
        self.audit_log_service.record(
            actor=user,
            action="USER_PASSWORD_CHANGED",
            entity_type="USER",
            entity_id=user.id,
            summary=f"Changed password for {user.first_name} {user.last_name} ({user.email})",
            details={"password_value_recorded": False},
        )
        self.db.commit()
        return TokenResponse(
            access_token=create_access_token(user.id, token_version=user.token_version)
        )

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
