"""Soft-deleted books must not circulate or delete while copies exist."""

from fastapi.testclient import TestClient
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.book import Book
from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    student_token,
)


def test_cannot_delete_book_with_available_copy(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """A book with an AVAILABLE copy cannot be soft-deleted."""
    response = client.delete(
        f"/api/v1/books/{catalog_book_with_copy['book_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 409


def test_issue_rejects_copy_of_deleted_book(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """After deleting a book its copies are no longer issuable."""
    # Simulate legacy data: soft-deleted book whose copies still exist.
    book = db_session.get(Book, catalog_book_with_copy["book_id"])
    assert book is not None
    book.deleted_at = func.now()
    db_session.flush()

    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert response.status_code == 404


def test_issue_by_inventory_code_rejects_deleted_book(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Inventory-code resolution also excludes copies of deleted books."""
    book = db_session.get(Book, catalog_book_with_copy["book_id"])
    assert book is not None
    book.deleted_at = func.now()
    db_session.flush()

    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "inventory_code": catalog_book_with_copy["inventory_code"],
            "student_code": catalog_book_with_copy["student_code"],
        },
    )
    assert response.status_code == 404
