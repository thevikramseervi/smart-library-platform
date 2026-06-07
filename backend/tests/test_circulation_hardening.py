"""Sprint 4.1 hardening tests."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.reservation import Reservation, ReservationStatus
from tests.conftest_circulation import catalog_book_with_copy  # noqa: F401


def test_student_cannot_list_transactions(
    client: TestClient,
    student_token: str,
) -> None:
    """Students cannot access the staff transaction list endpoint."""
    response = client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 403


def test_student_cannot_list_book_copies(
    client: TestClient,
    student_token: str,
) -> None:
    """Students cannot list inventory-level book copy records."""
    response = client.get(
        "/api/v1/book-copies",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 403


def test_student_cannot_return_book(
    client: TestClient,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Students cannot return books."""
    response = client.post(
        "/api/v1/transactions/return",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )
    assert response.status_code == 403


def test_duplicate_reservation_rejected(
    client: TestClient,
    admin_token: str,
    student2_token: str,
) -> None:
    """A student cannot create two active reservations for the same book."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=admin_headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Dup Reserve Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Dup Reserve Book {suffix}",
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

    first = client.post(
        "/api/v1/reservations",
        headers=student_headers,
        json={"book_id": book["id"]},
    )
    assert first.status_code == 201

    duplicate = client.post(
        "/api/v1/reservations",
        headers=student_headers,
        json={"book_id": book["id"]},
    )
    assert duplicate.status_code == 409
    assert "active reservation" in duplicate.json()["detail"].lower()


def test_stale_reservation_expires_on_list(
    client: TestClient,
    admin_token: str,
    student2_token: str,
) -> None:
    """Expired reservations are persisted when listing reservations."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=admin_headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Expire Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Expire Book {suffix}",
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

    created = client.post(
        "/api/v1/reservations",
        headers=student_headers,
        json={"book_id": book["id"]},
    )
    assert created.status_code == 201
    reservation_id = created.json()["id"]

    db: Session = SessionLocal()
    try:
        reservation = db.get(Reservation, reservation_id)
        assert reservation is not None
        reservation.expiry_date = datetime.now(UTC) - timedelta(days=1)
        db.commit()
    finally:
        db.close()

    listed = client.get("/api/v1/reservations/me", headers=student_headers)
    assert listed.status_code == 200
    expired = next(item for item in listed.json() if item["id"] == reservation_id)
    assert expired["status"] == "EXPIRED"

    db = SessionLocal()
    try:
        persisted = db.get(Reservation, reservation_id)
        assert persisted is not None
        assert persisted.status == ReservationStatus.EXPIRED
    finally:
        db.close()
