"""Catalog book endpoint tests."""

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


@pytest.fixture
def catalog_setup(client: TestClient, admin_token: str) -> dict:
    """Create publisher, author, category, and language for book tests."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]

    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")

    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Book Test Publisher {suffix}"},
    ).json()

    author = client.post(
        "/api/v1/authors",
        headers=headers,
        json={"name": f"Book Test Author {suffix}"},
    ).json()

    category = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": f"Book Test Category {suffix}", "description": "Testing"},
    ).json()

    return {
        "language_id": english["id"],
        "publisher_id": publisher["id"],
        "author_id": author["id"],
        "category_id": category["id"],
        "author_name": author["name"],
        "publisher_name": publisher["name"],
    }


def test_create_book_with_relations(
    client: TestClient,
    admin_token: str,
    catalog_setup: dict,
) -> None:
    """Admin can create a book linked to authors and categories."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "title": "Test Book Title",
        "isbn": f"978-{uuid.uuid4().hex[:10]}",
        "publisher_id": catalog_setup["publisher_id"],
        "language_id": catalog_setup["language_id"],
        "author_ids": [catalog_setup["author_id"]],
        "category_ids": [catalog_setup["category_id"]],
        "publication_year": 2024,
    }

    response = client.post("/api/v1/books", headers=headers, json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Book Title"
    assert len(data["authors"]) == 1
    assert len(data["categories"]) == 1
    assert data["copy_count"] == 0
    assert data["total_copies"] == 0
    assert data["available_copies"] == 0


def test_duplicate_isbn_rejected(
    client: TestClient,
    admin_token: str,
    catalog_setup: dict,
) -> None:
    """Duplicate ISBN should return 409."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    isbn = f"978-{uuid.uuid4().hex[:10]}"
    payload = {
        "title": "First Book",
        "isbn": isbn,
        "publisher_id": catalog_setup["publisher_id"],
        "language_id": catalog_setup["language_id"],
    }
    client.post("/api/v1/books", headers=headers, json=payload)

    duplicate = client.post(
        "/api/v1/books",
        headers=headers,
        json={**payload, "title": "Second Book"},
    )

    assert duplicate.status_code == 409


def test_book_search_by_author_and_publisher(
    client: TestClient,
    admin_token: str,
    catalog_setup: dict,
) -> None:
    """Search q should match author and publisher names."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": "Searchable Book",
            "publisher_id": catalog_setup["publisher_id"],
            "language_id": catalog_setup["language_id"],
            "author_ids": [catalog_setup["author_id"]],
        },
    )

    by_author = client.get(
        "/api/v1/books",
        headers=headers,
        params={"q": catalog_setup["author_name"]},
    )
    assert by_author.status_code == 200
    assert by_author.json()["total"] >= 1

    by_publisher = client.get(
        "/api/v1/books",
        headers=headers,
        params={"q": catalog_setup["publisher_name"]},
    )
    assert by_publisher.status_code == 200
    assert by_publisher.json()["total"] >= 1


def test_book_soft_delete_hidden_from_list(
    client: TestClient,
    admin_token: str,
    catalog_setup: dict,
) -> None:
    """Soft deleted books should not appear in list."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    create_response = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": "Delete Me Book",
            "publisher_id": catalog_setup["publisher_id"],
            "language_id": catalog_setup["language_id"],
        },
    )
    book_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/books/{book_id}", headers=headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert get_response.status_code == 404


def test_student_can_list_books(client: TestClient, student_token: str) -> None:
    """Student can read book list."""
    response = client.get(
        "/api/v1/books",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 200
    assert "items" in response.json()


def test_student_cannot_create_book(
    client: TestClient,
    student_token: str,
    catalog_setup: dict,
) -> None:
    """Student cannot create books."""
    response = client.post(
        "/api/v1/books",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "title": "Forbidden Book",
            "publisher_id": catalog_setup["publisher_id"],
            "language_id": catalog_setup["language_id"],
        },
    )

    assert response.status_code == 403
