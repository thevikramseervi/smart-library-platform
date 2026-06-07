"""Book copy lifecycle status tests."""

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
def librarian_token(client: TestClient) -> str:
    """Return a valid librarian JWT."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "librarian@library.local", "password": "librarian123456"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def book_with_copy(client: TestClient, admin_token: str) -> dict:
    """Create a book with one available copy."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Lifecycle Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": f"Lifecycle Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book["id"], "inventory_code": f"INV-{suffix}"},
    ).json()
    return {"book_id": book["id"], "copy_id": copy["id"], "inventory_code": copy["inventory_code"]}


def test_mark_copy_retired_reduces_available_count(
    client: TestClient,
    librarian_token: str,
    book_with_copy: dict,
) -> None:
    """Retired copies are excluded from available copy counts."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    response = client.put(
        f"/api/v1/book-copies/{book_with_copy['copy_id']}",
        headers=headers,
        json={"status": "RETIRED"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "RETIRED"

    book = client.get(f"/api/v1/books/{book_with_copy['book_id']}", headers=headers).json()
    assert book["total_copies"] >= 1
    assert book["available_copies"] == 0


def test_retired_copy_cannot_be_issued(
    client: TestClient,
    librarian_token: str,
    book_with_copy: dict,
) -> None:
    """Retired copies cannot be issued."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    client.put(
        f"/api/v1/book-copies/{book_with_copy['copy_id']}",
        headers=lib_headers,
        json={"status": "RETIRED"},
    )

    students = client.get(
        "/api/v1/circulation/students/search",
        headers=lib_headers,
        params={"q": "STU-001"},
    ).json()
    student_id = next(item["id"] for item in students if item.get("student_code") == "STU-001")

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={"book_copy_id": book_with_copy["copy_id"], "student_id": student_id},
    )
    assert issue.status_code == 409


def test_cannot_mark_borrowed_copy_as_lost(
    client: TestClient,
    librarian_token: str,
    book_with_copy: dict,
) -> None:
    """Borrowed copies must be returned before marking lost/damaged/retired."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    students = client.get(
        "/api/v1/circulation/students/search",
        headers=lib_headers,
        params={"q": "STU-001"},
    ).json()
    student_id = next(item["id"] for item in students if item.get("student_code") == "STU-001")

    client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={"book_copy_id": book_with_copy["copy_id"], "student_id": student_id},
    )

    response = client.put(
        f"/api/v1/book-copies/{book_with_copy['copy_id']}",
        headers=lib_headers,
        json={"status": "LOST"},
    )
    assert response.status_code == 409
    assert "return" in response.json()["detail"].lower()


def test_cannot_set_borrowed_status_manually(
    client: TestClient,
    librarian_token: str,
    book_with_copy: dict,
) -> None:
    """Circulation-managed statuses cannot be set via copy update."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    response = client.put(
        f"/api/v1/book-copies/{book_with_copy['copy_id']}",
        headers=headers,
        json={"status": "BORROWED"},
    )
    assert response.status_code == 409
