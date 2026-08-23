"""Queue-aware issue and return workflow tests."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.book_copy import BookCopy
from app.models.transaction import Transaction
from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    student2_token,
    student_token,
)


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_available_copy(client: TestClient, token: str) -> str:
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=_headers(token)).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=_headers(token),
        json={"name": f"Queue Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=_headers(token),
        json={
            "title": f"Queue Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=_headers(token),
        json={"book_id": book["id"], "inventory_code": f"QUEUE-{suffix}"},
    ).json()
    return copy["id"]


def _reserve(client: TestClient, token: str, book_id: str):
    me = client.get("/api/v1/auth/me", headers=_headers(token)).json()
    return client.post(
        "/api/v1/reservations",
        headers=_headers(token),
        json={"book_id": book_id},
    ), me["id"]


def test_return_with_queue_sets_copy_reserved(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Returning a copy that has a waiting queue holds it as RESERVED."""
    data = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201

    reservation, _ = _reserve(client, student2_token, data["book_id"])
    assert reservation.status_code == 201

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    copy = db_session.get(BookCopy, data["copy_id"])
    assert copy is not None
    assert copy.status.value == "RESERVED"


def test_walkup_issue_blocked_without_bypass(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Issuing to someone not in queue requires an explicit bypass."""
    data = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201
    _, _ = _reserve(client, student2_token, data["book_id"])
    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    # A second copy of the same queued title becomes AVAILABLE.
    suffix = uuid.uuid4().hex[:8]
    second_copy = client.post(
        "/api/v1/book-copies",
        headers=_headers(admin_token),
        json={"book_id": data["book_id"], "inventory_code": f"QUEUE2-{suffix}"},
    ).json()

    blocked = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={
            "book_copy_id": second_copy["id"],
            "student_id": data["student_id"],
        },
    )
    assert blocked.status_code == 409
    assert "bypass_reservation" in blocked.json()["detail"]

    bypassed = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={
            "book_copy_id": second_copy["id"],
            "student_id": data["student_id"],
            "bypass_reservation": True,
        },
    )
    assert bypassed.status_code == 201


def test_head_of_queue_can_issue_reserved_copy_and_link_recorded(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """The first queued student fulfills their held copy; the link persists."""
    data = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201

    reservation, student_id = _reserve(client, student2_token, data["book_id"])
    assert reservation.status_code == 201

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    fulfilled = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"], "student_id": student_id},
    )
    assert fulfilled.status_code == 201
    body = fulfilled.json()
    transaction = db_session.get(Transaction, body["id"])
    assert transaction is not None
    assert transaction.reservation_id is not None

    my_reservations = client.get("/api/v1/reservations/me", headers=_headers(student2_token)).json()
    mine = next(r for r in my_reservations if r["id"] == reservation.json()["id"])
    assert mine["status"] == "FULFILLED"


def test_cancelled_last_reservation_releases_held_copy(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """When the last queue entry is cancelled a RESERVED copy returns to AVAILABLE."""
    data = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201

    reservation, _ = _reserve(client, student2_token, data["book_id"])
    assert reservation.status_code == 201
    reservation_id = reservation.json()["id"]

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(admin_token),
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    cancelled = client.delete(
        f"/api/v1/reservations/{reservation_id}",
        headers=_headers(student2_token),
    )
    assert cancelled.status_code in (200, 204)

    copy = db_session.get(BookCopy, data["copy_id"])
    assert copy is not None
    assert copy.status.value == "AVAILABLE"
