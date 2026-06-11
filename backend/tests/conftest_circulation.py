"""Shared circulation test fixtures."""

import uuid
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


def utc_today() -> date:
    """Return the current date in UTC to match circulation timestamps."""
    return datetime.now(UTC).date()


@pytest.fixture(autouse=True)
def clean_student_circulation_state(client: TestClient, admin_token: str, student_token: str) -> None:
    """Return active loans and pay fines so circulation tests start clean."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    me = client.get("/api/v1/auth/me", headers=student_headers).json()

    active = client.get("/api/v1/transactions/me/active", headers=student_headers).json()
    for transaction in active:
        client.post(
            "/api/v1/transactions/return",
            headers=admin_headers,
            json={"book_copy_id": transaction["book_copy_id"]},
        )

    fines = client.get(
        "/api/v1/fines",
        headers=admin_headers,
        params={"student_id": me["id"], "paid": False},
    ).json()
    for fine in fines.get("items", []):
        client.post(f"/api/v1/fines/{fine['id']}/pay", headers=admin_headers)


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
def librarian_token(client: TestClient) -> str:
    """Return a valid librarian JWT."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_LIBRARIAN_EMAIL, "password": settings.DEV_LIBRARIAN_PASSWORD},
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
def student2_token(client: TestClient) -> str:
    """Return a second student JWT for reservation tests."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "student2@library.local", "password": "student123456"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def catalog_book_with_copy(client: TestClient, admin_token: str) -> dict:
    """Create a book with one available copy."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Circulation Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": f"Circulation Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book["id"], "inventory_code": f"INV-{suffix}"},
    ).json()
    me = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': 'student@library.local', 'password': 'student123456'}).json()['access_token']}"
        },
    ).json()
    return {
        "book_id": book["id"],
        "copy_id": copy["id"],
        "inventory_code": copy["inventory_code"],
        "student_id": me["id"],
        "student_code": me["student_code"],
    }
