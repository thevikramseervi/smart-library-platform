"""Overdue determination must use one clock end-to-end."""

from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_now, utc_today
from app.core.config import settings
from app.models.transaction import Transaction


def _issue(client: TestClient, token: str, copy: dict, student_id: str) -> UUID:
    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {token}"},
        json={"book_copy_id": copy["id"], "student_id": student_id},
    )
    assert response.status_code == 201
    return UUID(response.json()["id"])


def test_is_overdue_matches_utc_calendar(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """A loan due today-UTC is not overdue; due yesterday-UTC is."""
    data = catalog_book_with_copy
    transaction_id = _issue(client, admin_token, {"id": data["copy_id"]}, data["student_id"])

    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None

    transaction.due_at = utc_today()
    db_session.flush()
    listed = client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"overdue": "true", "student_id": data["student_id"]},
    ).json()
    assert all(item["id"] != str(transaction_id) for item in listed["items"])

    transaction.due_at = utc_today() - timedelta(days=1)
    db_session.flush()
    listed = client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"overdue": "true", "student_id": data["student_id"]},
    ).json()
    assert any(item["id"] == str(transaction_id) for item in listed["items"])
    assert listed["items"][0]["is_overdue"] is True


def test_return_after_due_date_charges_fine_consistently(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """The fine trigger and the overdue flag agree at the day boundary."""
    data = catalog_book_with_copy
    transaction_id = _issue(client, admin_token, {"id": data["copy_id"]}, data["student_id"])

    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=2)
    db_session.flush()

    returned = client.post(
        "/api/v1/transactions/return",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200
    body = returned.json()
    assert body["status"] == "RETURNED"

    fines = client.get(
        "/api/v1/fines",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"student_id": data["student_id"], "paid": "false"},
    ).json()
    assert fines["total"] >= 1

    expected_days = (utc_now().date() - (utc_today() - timedelta(days=2))).days
    amount = next(fine["amount"] for fine in fines["items"])
    assert Decimal(str(amount)) == Decimal(expected_days) * settings.DAILY_OVERDUE_FINE_RATE
