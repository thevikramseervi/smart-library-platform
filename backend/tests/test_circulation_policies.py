"""Circulation policy endpoint and dynamic integration tests."""

from datetime import timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.models.transaction import Transaction


def test_get_circulation_policy(
    client: TestClient,
    admin_token: str,
    librarian_token: str,
) -> None:
    """Admin and librarian can read the active circulation policy."""
    for token in (admin_token, librarian_token):
        response = client.get(
            "/api/v1/circulation-policies",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "daily_overdue_fine_rate" in data
        assert "max_fine_amount" in data
        assert "loan_period_days" in data
        assert "max_active_loans" in data
        assert "reservation_expiry_days" in data


def test_student_cannot_access_or_update_circulation_policy(
    client: TestClient,
    student_token: str,
) -> None:
    """Students are forbidden from reading or updating circulation policies."""
    get_res = client.get(
        "/api/v1/circulation-policies",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert get_res.status_code == 403

    put_res = client.put(
        "/api/v1/circulation-policies",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "daily_overdue_fine_rate": "20.00",
            "max_fine_amount": "500.00",
            "loan_period_days": 14,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert put_res.status_code == 403


def test_librarian_cannot_update_circulation_policy(
    client: TestClient,
    librarian_token: str,
) -> None:
    """Librarians can view but not update circulation policies."""
    put_res = client.put(
        "/api/v1/circulation-policies",
        headers={"Authorization": f"Bearer {librarian_token}"},
        json={
            "daily_overdue_fine_rate": "20.00",
            "max_fine_amount": "500.00",
            "loan_period_days": 14,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert put_res.status_code == 403


def test_update_circulation_policy_validation(
    client: TestClient,
    admin_token: str,
) -> None:
    """Validation rejects negative fine rates or fine caps lower than the daily rate."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Negative rate
    res = client.put(
        "/api/v1/circulation-policies",
        headers=headers,
        json={
            "daily_overdue_fine_rate": "-5.00",
            "max_fine_amount": "500.00",
            "loan_period_days": 14,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert res.status_code == 422

    # Cap lower than daily rate
    res = client.put(
        "/api/v1/circulation-policies",
        headers=headers,
        json={
            "daily_overdue_fine_rate": "50.00",
            "max_fine_amount": "10.00",
            "loan_period_days": 14,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert res.status_code == 422


def test_circulation_flow_uses_updated_policy(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Issue, loan duration, and fine calculations immediately reflect updated policy."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    data = catalog_book_with_copy

    # Admin updates policy: 10-day loan period, ₹25.00/day fine, ₹200.00 cap
    put_res = client.put(
        "/api/v1/circulation-policies",
        headers=headers,
        json={
            "daily_overdue_fine_rate": "25.00",
            "max_fine_amount": "200.00",
            "loan_period_days": 10,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert put_res.status_code == 200
    updated_policy = put_res.json()
    assert Decimal(str(updated_policy["daily_overdue_fine_rate"])) == Decimal("25.00")
    assert Decimal(str(updated_policy["max_fine_amount"])) == Decimal("200.00")
    assert updated_policy["loan_period_days"] == 10
    assert updated_policy["updated_by_user"] is not None

    # Issue book to student
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": data["copy_id"], "student_id": data["student_id"]},
    )
    assert issue.status_code == 201
    issue_data = issue.json()
    transaction_id = issue_data["id"]

    # Verify loan period matches the updated 10 days
    expected_due = utc_today() + timedelta(days=10)
    assert issue_data["due_at"] == expected_due.isoformat()

    # Simulate book being returned 3 days overdue
    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=3)
    db_session.flush()

    # Return book
    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": data["copy_id"]},
    )
    assert returned.status_code == 200

    # Verify fine calculated with the updated rate: 3 * 25.00 = 75.00
    fines = client.get(
        "/api/v1/fines",
        headers=headers,
        params={"student_id": data["student_id"], "paid": "false"},
    ).json()
    fine = next(f for f in fines["items"] if f["transaction_id"] == transaction_id)
    assert Decimal(str(fine["amount"])) == Decimal("75.00")

    # Reset policy back to standard baseline so other tests remain clean
    reset_res = client.put(
        "/api/v1/circulation-policies",
        headers=headers,
        json={
            "daily_overdue_fine_rate": "10.00",
            "max_fine_amount": "500.00",
            "loan_period_days": 14,
            "max_active_loans": 5,
            "reservation_expiry_days": 7,
        },
    )
    assert reset_res.status_code == 200
