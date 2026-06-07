"""Catalog category endpoint tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


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


def test_category_get_update_and_soft_delete_hidden(client: TestClient, admin_token: str) -> None:
    """Admin can get, update, and soft-deleted categories return 404 on get."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]

    create_response = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": f"Test Category {suffix}", "description": "Testing"},
    )
    assert create_response.status_code == 201
    category_id = create_response.json()["id"]

    get_response = client.get(f"/api/v1/categories/{category_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["name"] == f"Test Category {suffix}"

    update_response = client.put(
        f"/api/v1/categories/{category_id}",
        headers=headers,
        json={"name": f"Updated Category {suffix}"},
    )
    assert update_response.status_code == 200

    get_updated = client.get(f"/api/v1/categories/{category_id}", headers=headers)
    assert get_updated.status_code == 200
    assert get_updated.json()["name"] == f"Updated Category {suffix}"

    delete_response = client.delete(f"/api/v1/categories/{category_id}", headers=headers)
    assert delete_response.status_code == 204

    get_after_delete = client.get(f"/api/v1/categories/{category_id}", headers=headers)
    assert get_after_delete.status_code == 404


def test_get_category_student_allowed(client: TestClient, admin_token: str, student_token: str) -> None:
    """Student can read a category by id."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]
    create_response = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": f"Readable Category {suffix}", "description": "Browse"},
    )
    category_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/categories/{category_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == f"Readable Category {suffix}"
