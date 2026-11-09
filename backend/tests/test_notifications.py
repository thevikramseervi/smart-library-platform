"""In-app notification lifecycle and ownership tests."""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.models.transaction import Transaction


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _issue(client: TestClient, librarian_token: str, catalog_book_with_copy: dict) -> dict:
    response = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(librarian_token),
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_issuing_a_book_notifies_student_with_due_date(
    client: TestClient,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)

    center = client.get("/api/v1/notifications", headers=_headers(student_token))

    assert center.status_code == 200
    assert center.json()["unread_count"] == 1
    notification = center.json()["items"][0]
    assert notification["notification_type"] == "BOOK_ISSUED"
    assert "due on" in notification["message"]
    assert notification["link"] == "/circulation/my-loans"
    readable_due_date = date.fromisoformat(issued["due_at"]).strftime("%d %b %Y")
    assert readable_due_date in notification["message"]


def test_due_soon_notification_is_created_once_and_can_be_read(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() + timedelta(days=2)
    db_session.flush()

    first = client.get("/api/v1/notifications", headers=_headers(student_token))
    second = client.get("/api/v1/notifications", headers=_headers(student_token))
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["unread_count"] == 2
    assert second.json()["unread_count"] == 2
    notification = next(
        item for item in first.json()["items"] if item["notification_type"] == "DUE_SOON"
    )
    assert notification["notification_type"] == "DUE_SOON"
    assert "due on" in notification["message"]
    assert notification["link"] == "/circulation/my-loans"

    marked_read = client.post(
        f"/api/v1/notifications/{notification['id']}/read",
        headers=_headers(student_token),
    )
    assert marked_read.status_code == 200
    assert marked_read.json()["read_at"] is not None
    refreshed = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    assert refreshed["unread_count"] == 1


def test_notifications_are_private_to_their_owner(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() + timedelta(days=1)
    db_session.flush()
    notifications = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    notification_id = next(
        item["id"] for item in notifications["items"] if item["notification_type"] == "BOOK_ISSUED"
    )

    hidden = client.post(
        f"/api/v1/notifications/{notification_id}/read",
        headers=_headers(student2_token),
    )
    assert hidden.status_code == 404
    other_center = client.get(
        "/api/v1/notifications",
        headers=_headers(student2_token),
    ).json()
    assert other_center["items"] == []


def test_return_notifies_next_reservation_student(
    client: TestClient,
    librarian_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    reserved = client.post(
        "/api/v1/reservations",
        headers=_headers(student2_token),
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    assert reserved.status_code == 201

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(librarian_token),
        json={"book_copy_id": issued["book_copy_id"]},
    )
    assert returned.status_code == 200
    center = client.get("/api/v1/notifications", headers=_headers(student2_token)).json()
    assert center["unread_count"] == 1
    assert center["items"][0]["notification_type"] == "RESERVATION_READY"
    assert center["items"][0]["link"] == "/circulation/my-reservations"


def test_return_notifies_the_borrower(
    client: TestClient,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(librarian_token),
        json={"book_copy_id": issued["book_copy_id"]},
    )
    assert returned.status_code == 200
    center = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    return_notification = next(
        item for item in center["items"] if item["notification_type"] == "BOOK_RETURNED"
    )
    assert "returned" in return_notification["message"].lower()
    assert return_notification["link"] == "/circulation/my-loans"


def test_overdue_return_notifies_student_of_recorded_fine(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() - timedelta(days=1)
    db_session.flush()

    overdue_first = client.get(
        "/api/v1/notifications",
        headers=_headers(student_token),
    ).json()
    overdue_second = client.get(
        "/api/v1/notifications",
        headers=_headers(student_token),
    ).json()
    overdue_alerts = [
        item
        for item in overdue_first["items"]
        if item["notification_type"] == "LOAN_OVERDUE"
    ]
    assert len(overdue_alerts) == 1
    assert overdue_second["unread_count"] == overdue_first["unread_count"]
    assert "current overdue days and fine balance" in overdue_alerts[0]["message"]
    assert overdue_alerts[0]["link"] == "/circulation/my-loans"

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(librarian_token),
        json={"book_copy_id": issued["book_copy_id"]},
    )
    assert returned.status_code == 200
    center = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    fine_notification = next(
        item for item in center["items"] if item["notification_type"] == "FINE_RECORDED"
    )
    assert fine_notification["link"] == "/circulation/my-fines"
    assert any(item["id"] == overdue_alerts[0]["id"] for item in center["items"])
    assert any(item["notification_type"] == "BOOK_RETURNED" for item in center["items"])

    my_fines = client.get("/api/v1/fines/me", headers=_headers(student_token)).json()
    fine = next(item for item in my_fines if item["transaction_id"] == issued["id"])
    paid = client.post(
        f"/api/v1/fines/{fine['id']}/pay",
        headers=_headers(librarian_token),
    )
    assert paid.status_code == 200
    updated_center = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    paid_notification = next(
        item for item in updated_center["items"] if item["notification_type"] == "FINE_PAID"
    )
    assert "payment" in paid_notification["title"].lower()
    assert paid_notification["link"] == "/circulation/my-fines"


def test_fine_paid_with_return_sends_one_payment_confirmation(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() - timedelta(days=1)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers=_headers(librarian_token),
        json={"book_copy_id": issued["book_copy_id"], "pay_fine": True},
    )
    assert returned.status_code == 200
    center = client.get("/api/v1/notifications", headers=_headers(student_token)).json()
    assert any(item["notification_type"] == "BOOK_RETURNED" for item in center["items"])
    assert any(item["notification_type"] == "FINE_PAID" for item in center["items"])
    assert not any(item["notification_type"] == "FINE_RECORDED" for item in center["items"])


def test_mark_all_read_clears_only_the_current_users_unread_count(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    issued = _issue(client, librarian_token, catalog_book_with_copy)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() + timedelta(days=1)
    db_session.flush()
    client.get("/api/v1/notifications", headers=_headers(student_token))

    marked = client.post("/api/v1/notifications/read-all", headers=_headers(student_token))
    assert marked.status_code == 204
    student_center = client.get(
        "/api/v1/notifications",
        headers=_headers(student_token),
    ).json()
    other_center = client.get(
        "/api/v1/notifications",
        headers=_headers(student2_token),
    ).json()
    assert student_center["unread_count"] == 0
    assert other_center["unread_count"] == 0
