"""Fine amount clamping and idempotent payment tests."""

from datetime import timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.core.config import settings
from app.models.transaction import Transaction


def _issue_and_return_late(
    client: TestClient,
    db_session: Session,
    token: str,
    data: dict,
    days_late: int,
) -> dict:
    issue = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {token}"},
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201
    transaction_id = issue.json()["id"]

    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=days_late)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers={"Authorization": f"Bearer {token}"},
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    fines = client.get(
        "/api/v1/fines",
        headers={"Authorization": f"Bearer {token}"},
        params={"student_id": data["student_id"], "paid": "false"},
    ).json()
    return fines["items"][0]


def test_fine_amount_is_capped(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """A very late return produces the capped amount, not unbounded accrual."""
    fine = _issue_and_return_late(
        client,
        db_session,
        admin_token,
        catalog_book_with_copy,
        days_late=4000,
    )
    assert Decimal(str(fine["amount"])) == settings.MAX_FINE_AMOUNT
    assert fine["is_capped"] is False
    assert fine["student_name"]
    assert fine["book_title"]
    assert fine["inventory_code"] == catalog_book_with_copy["inventory_code"]

    filtered = client.get(
        "/api/v1/fines",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"q": catalog_book_with_copy["inventory_code"]},
    )
    assert filtered.status_code == 200
    assert any(item["id"] == fine["id"] for item in filtered.json()["items"])


def test_marking_fine_paid_twice_conflicts(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Second payment attempt on the same fine returns 409."""
    fine = _issue_and_return_late(
        client,
        db_session,
        admin_token,
        catalog_book_with_copy,
        days_late=3,
    )
    headers = {"Authorization": f"Bearer {admin_token}"}
    first = client.post(f"/api/v1/fines/{fine['id']}/pay", headers=headers)
    assert first.status_code in (200, 204)

    second = client.post(f"/api/v1/fines/{fine['id']}/pay", headers=headers)
    assert second.status_code == 409


def test_open_overdue_loan_accrues_fine_and_blocks_borrowing(
    client: TestClient,
    db_session: Session,
    librarian_token: str,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """An unreturned overdue book shows its balance and blocks another issue."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert issue.status_code == 201
    transaction = db_session.get(Transaction, issue.json()["id"])
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=4000)
    db_session.flush()

    fines = client.get(
        "/api/v1/fines/me",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert fines.status_code == 200
    fine = next(item for item in fines.json() if item["transaction_id"] == issue.json()["id"])
    assert Decimal(str(fine["amount"])) == settings.MAX_FINE_AMOUNT
    assert fine["is_accruing"] is True
    assert fine["is_capped"] is True

    payment = client.post(f"/api/v1/fines/{fine['id']}/pay", headers=headers)
    assert payment.status_code == 409
    assert "returned" in payment.json()["detail"].lower()

    second_copy = client.post(
        "/api/v1/book-copies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    blocked = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": second_copy.json()["id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert blocked.status_code == 409
    assert "unpaid fines" in blocked.json()["detail"].lower()

    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )
    assert returned.status_code == 200
    assert Decimal(str(returned.json()["fine_amount"])) == settings.MAX_FINE_AMOUNT
    finalized = client.get(
        "/api/v1/fines/me",
        headers={"Authorization": f"Bearer {student_token}"},
    ).json()
    finalized_fine = next(item for item in finalized if item["id"] == fine["id"])
    assert finalized_fine["is_accruing"] is False
    assert finalized_fine["is_capped"] is False
    assert finalized_fine["reason"].startswith("Overdue return")


def test_return_can_atomically_record_fine_payment(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Staff can record an accepted payment together with an overdue return."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert issue.status_code == 201
    transaction = db_session.get(Transaction, issue.json()["id"])
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=2)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"], "pay_fine": True},
    )
    assert returned.status_code == 200

    fines = client.get(
        "/api/v1/fines",
        headers=headers,
        params={"student_id": catalog_book_with_copy["student_id"]},
    )
    fine = next(
        item for item in fines.json()["items"] if item["transaction_id"] == issue.json()["id"]
    )
    assert fine["paid"] is True
