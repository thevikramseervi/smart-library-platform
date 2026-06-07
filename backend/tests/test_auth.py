"""Authentication endpoint tests."""

from datetime import timedelta
from uuid import UUID

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from jose import jwt

from app.api.deps import require_roles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.services.auth_service import AuthService


@pytest.fixture
def admin_token(client: TestClient) -> str:
    """Return a valid admin JWT."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_ADMIN_EMAIL, "password": settings.DEV_ADMIN_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def student_token(client: TestClient) -> str:
    """Return a valid student JWT."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "student@library.local", "password": "student123456"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def rbac_client() -> TestClient:
    """Test client with a temporary admin-only route for RBAC checks."""
    rbac_app = FastAPI()
    rbac_app.include_router(api_router, prefix="/api/v1")

    @rbac_app.get("/api/v1/rbac-admin-test")
    def admin_only(current_user: User = Depends(require_roles("ADMIN"))) -> dict[str, bool]:
        return {"ok": True}

    with TestClient(rbac_app) as test_client:
        yield test_client


def test_login_success(client: TestClient) -> None:
    """Valid credentials should return an access token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_ADMIN_EMAIL, "password": settings.DEV_ADMIN_PASSWORD},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient) -> None:
    """Invalid password should return 401."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_ADMIN_EMAIL, "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_login_unknown_email(client: TestClient) -> None:
    """Unknown email should return 401."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@library.local", "password": "any-password"},
    )

    assert response.status_code == 401


def test_me_authenticated(client: TestClient, admin_token: str) -> None:
    """Authenticated request should return user profile without password."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == settings.DEV_ADMIN_EMAIL
    assert data["role"]["name"] == "ADMIN"
    assert "password_hash" not in data
    assert "password" not in data


def test_me_missing_token(client: TestClient) -> None:
    """Missing token should return 401."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_invalid_token(client: TestClient) -> None:
    """Invalid token should return 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_me_expired_token(client: TestClient) -> None:
    """Expired token should return 401."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_ADMIN_EMAIL, "password": settings.DEV_ADMIN_PASSWORD},
    )
    user_id = UUID(jwt.get_unverified_claims(login_response.json()["access_token"])["sub"])
    expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-1))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


def test_require_roles_allows_admin(rbac_client: TestClient, admin_token: str) -> None:
    """Admin role should pass admin-only dependency."""
    response = rbac_client.get(
        "/api/v1/rbac-admin-test",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_require_roles_rejects_student(rbac_client: TestClient, student_token: str) -> None:
    """Student role should be rejected by admin-only dependency."""
    response = rbac_client.get(
        "/api/v1/rbac-admin-test",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 403


def test_ensure_user_has_role_forbidden(client: TestClient, student_token: str) -> None:
    """Service-level role check should raise for insufficient role."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        auth_service = AuthService(db)
        user = auth_service.authenticate_token(student_token)
        with pytest.raises(HTTPException) as exc_info:
            auth_service.ensure_user_has_role(user, "ADMIN")
        assert exc_info.value.status_code == 403
    finally:
        db.close()
