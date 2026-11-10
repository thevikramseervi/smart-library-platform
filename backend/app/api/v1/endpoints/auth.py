"""Authentication endpoints."""

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import get_auth_service, get_current_user, security
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChangeRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> Response:
    """Revoke the bearer token used for this session."""
    auth_service.logout(credentials.credentials)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _client_ip(request: Request) -> str:
    """Return the originating client IP, honoring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: LoginRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """Authenticate a user and return a JWT access token."""
    return auth_service.login(credentials, client_ip=_client_ip(request))


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """Return the current authenticated user's profile."""
    return auth_service.get_user_profile(current_user.id)


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """Change the authenticated user's password and rotate their session token."""
    return auth_service.change_password(current_user, payload)
