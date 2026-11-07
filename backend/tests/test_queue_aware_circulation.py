"""Queue-aware issue and return workflow tests."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.book_copy import BookCopy
from app.models.reservation import Reservation
from app.models.transaction import Transaction


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


def test_return_expires_stale_queue_and_releases_copy(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """An expired reservation must not leave a returned copy held."""
    data = catalog_book_with_copy
    headers = _headers(admin_token)
    issued = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issued.status_code == 201

    reservation, _ = _reserve(client, student2_token, data["book_id"])
    assert reservation.status_code == 201
    row = db_session.get(Reservation, reservation.json()["id"])
    assert row is not None
    row.expiry_date = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200
    db_session.refresh(row)
    assert row.status.value == "EXPIRED"
    copy = db_session.get(BookCopy, data["copy_id"])
    assert copy is not None
    assert copy.status.value == "AVAILABLE"


def test_expired_queue_head_does_not_block_walkup_issue(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Issue decisions should ignore expired queue entries without a prior list call."""
    data = catalog_book_with_copy
    headers = _headers(admin_token)
    first_issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert first_issue.status_code == 201
    reservation, _ = _reserve(client, student2_token, data["book_id"])
    assert reservation.status_code == 201
    expired = db_session.get(Reservation, reservation.json()["id"])
    assert expired is not None
    expired.expiry_date = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    walkup = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert walkup.status_code == 201
    db_session.refresh(expired)
    assert expired.status.value == "EXPIRED"


def test_staff_transaction_search_matches_book_copy_code(
    client: TestClient,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Staff can find an active loan using its book title or borrower identity."""
    data = catalog_book_with_copy
    headers = _headers(admin_token)
    issued = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issued.status_code == 201

    response = client.get(
        "/api/v1/transactions",
        headers=headers,
        params={"status": "ISSUED", "q": data["inventory_code"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == issued.json()["id"]
