"""Catalog publisher endpoint tests."""

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


def test_publisher_crud_and_soft_delete(client: TestClient, admin_token: str) -> None:
    """Admin can create, update, and soft delete publishers."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]

    create_response = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={
            "name": f"Test Publisher {suffix}",
            "website": "https://example.com",
            "country": "India",
        },
    )
    assert create_response.status_code == 201
    publisher_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/v1/publishers/{publisher_id}",
        headers=headers,
        json={"name": f"Updated Publisher {suffix}"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == f"Updated Publisher {suffix}"

    get_response = client.get(f"/api/v1/publishers/{publisher_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == publisher_id
    assert get_response.json()["name"] == f"Updated Publisher {suffix}"

    list_response = client.get("/api/v1/publishers", headers=headers)
    assert list_response.status_code == 200
    assert any(pub["id"] == publisher_id for pub in list_response.json())

    delete_response = client.delete(f"/api/v1/publishers/{publisher_id}", headers=headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get("/api/v1/publishers", headers=headers)
    assert not any(pub["id"] == publisher_id for pub in list_after_delete.json())

    get_after_delete = client.get(f"/api/v1/publishers/{publisher_id}", headers=headers)
    assert get_after_delete.status_code == 404


def test_get_publisher_student_allowed(client: TestClient, admin_token: str, student_token: str) -> None:
    """Student can read a publisher by id."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]
    create_response = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Readable Publisher {suffix}"},
    )
    publisher_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/publishers/{publisher_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == f"Readable Publisher {suffix}"


def test_create_publisher_student_forbidden(client: TestClient, student_token: str) -> None:
    """Student cannot create publishers."""
    response = client.post(
        "/api/v1/publishers",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"name": "Forbidden Publisher"},
    )

    assert response.status_code == 403
