"""Catalog language endpoint tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.db.seed import seed_languages


@pytest.fixture(autouse=True)
def ensure_seed_languages() -> None:
    """Ensure default seed languages exist regardless of shared DB state."""
    db = SessionLocal()
    try:
        seed_languages(db)
        db.commit()
    finally:
        db.close()


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


def test_list_languages_authenticated(client: TestClient, admin_token: str) -> None:
    """Authenticated users can list seeded languages."""
    response = client.get(
        "/api/v1/languages",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    codes = {lang["code"] for lang in data}
    assert "en" in codes
    assert "hi" in codes


def test_create_language_admin(client: TestClient, admin_token: str) -> None:
    """Admin can create a language."""
    suffix = uuid.uuid4().hex[:6]
    response = client.post(
        "/api/v1/languages",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"French {suffix}", "code": f"fr{suffix}"},
    )

    assert response.status_code == 201
    assert response.json()["code"] == f"fr{suffix}"


def test_create_language_duplicate_code(client: TestClient, admin_token: str) -> None:
    """Duplicate language code should return 409."""
    response = client.post(
        "/api/v1/languages",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "English Duplicate", "code": "en"},
    )

    assert response.status_code == 409


def test_create_language_student_forbidden(client: TestClient, student_token: str) -> None:
    """Student cannot create languages."""
    response = client.post(
        "/api/v1/languages",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"name": "Spanish", "code": "es"},
    )

    assert response.status_code == 403
