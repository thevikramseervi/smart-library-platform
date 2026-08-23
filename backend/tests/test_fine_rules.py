"""Fine amount clamping and idempotent payment tests."""

from datetime import timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.core.config import settings
from app.models.transaction import Transaction
from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    student_token,
)


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
