"""Reservation and fine payment circulation tests."""

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.transaction import Transaction
from tests.conftest_circulation import catalog_book_with_copy  # noqa: F401


def test_reservation_requires_no_available_copies(
    client: TestClient,
    admin_token: str,
    student_token: str,
    student2_token: str,
) -> None:
    """Students can reserve only when no copies are available."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student2_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=admin_headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Reserve Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Reserve Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": book["id"], "inventory_code": f"INV-{suffix}"},
    ).json()

    blocked = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": book["id"]},
    )
    assert blocked.status_code == 409

    client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={
            "inventory_code": copy["inventory_code"],
            "student_code": "STU-001",
        },
    )

    allowed = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": book["id"]},
    )
    assert allowed.status_code == 201
    assert allowed.json()["queue_position"] == 1


def test_reservation_fifo_queue(
    client: TestClient,
    admin_token: str,
    student2_token: str,
) -> None:
    """Reservation queue follows FIFO ordering."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=admin_headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Queue Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Queue Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": book["id"], "inventory_code": f"INV-{suffix}"},
    ).json()
    client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"inventory_code": copy["inventory_code"], "student_code": "STU-001"},
    )

    client.post(
        "/api/v1/reservations",
        headers=student_headers,
        json={"book_id": book["id"]},
    )

    queue = client.get(
        f"/api/v1/reservations/queue/{book['id']}",
        headers=admin_headers,
    )
    assert queue.status_code == 200
    assert len(queue.json()) == 1
    assert queue.json()[0]["queue_position"] == 1
    assert queue.json()[0]["student"]["student_code"] == "STU-002"


def test_mark_fine_paid_unblocks_borrowing(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Paying a fine allows the student to borrow again."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    transaction_id = issue.json()["id"]
    db: Session = SessionLocal()
    try:
        transaction = db.get(Transaction, transaction_id)
        assert transaction is not None
        transaction.due_at = date.today() - timedelta(days=1)
        db.commit()
    finally:
        db.close()

    client.post(
        "/api/v1/transactions/return",
        headers=lib_headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )
    fines = client.get("/api/v1/fines/me", headers={"Authorization": f"Bearer {student_token}"})
    fine_id = fines.json()[0]["id"]

    paid = client.post(f"/api/v1/fines/{fine_id}/pay", headers=lib_headers)
    assert paid.status_code == 200
    assert paid.json()["paid"] is True

    new_copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": catalog_book_with_copy["book_id"]},
    ).json()
    issue_again = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": new_copy["id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert issue_again.status_code == 201
