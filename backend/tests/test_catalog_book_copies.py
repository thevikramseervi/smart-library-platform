"""Catalog book copy endpoint tests."""

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
def book_id(client: TestClient, admin_token: str) -> str:
    """Create a minimal book and return its id."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Copy Test Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": "Copy Test Book",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    return book["id"]


def test_create_book_copy_sets_qr_code(
    client: TestClient,
    admin_token: str,
    book_id: str,
) -> None:
    """Creating a copy sets qr_code_value equal to inventory_code."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    inventory_code = f"INV-{uuid.uuid4().hex[:8]}"
    response = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={
            "book_id": book_id,
            "inventory_code": inventory_code,
            "location": "Shelf A1",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["inventory_code"] == inventory_code
    assert data["qr_code_value"] == inventory_code
    assert data["status"] == "AVAILABLE"


def test_duplicate_inventory_code_rejected(
    client: TestClient,
    admin_token: str,
    book_id: str,
) -> None:
    """Duplicate inventory code should return 409."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    inventory_code = f"INV-{uuid.uuid4().hex[:8]}"
    payload = {"book_id": book_id, "inventory_code": inventory_code}
    client.post("/api/v1/book-copies", headers=headers, json=payload)

    duplicate = client.post("/api/v1/book-copies", headers=headers, json=payload)

    assert duplicate.status_code == 409


def test_list_copies_filter_by_book(
    client: TestClient,
    admin_token: str,
    book_id: str,
) -> None:
    """List copies filtered by book_id."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    inventory_code = f"INV-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book_id, "inventory_code": inventory_code},
    )

    response = client.get(
        "/api/v1/book-copies",
        headers=headers,
        params={"book_id": book_id},
    )

    assert response.status_code == 200
    copies = response.json()
    assert len(copies) >= 1
    assert all(copy["book_id"] == book_id for copy in copies)


def test_book_copy_aggregates_on_book_response(
    client: TestClient,
    admin_token: str,
    book_id: str,
) -> None:
    """Book response should reflect copy aggregates."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    inventory_code = f"INV-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book_id, "inventory_code": inventory_code},
    )

    response = client.get(f"/api/v1/books/{book_id}", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["total_copies"] >= 1
    assert data["copy_count"] == data["total_copies"]
    assert data["available_copies"] >= 1
