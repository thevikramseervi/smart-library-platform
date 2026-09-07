"""Circulation issue and return tests."""

from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.transaction import Transaction
from tests.conftest_circulation import utc_today


def test_issue_and_return_flow(
    client: TestClient,
    librarian_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Librarian can issue and return a copy."""
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
    data = issue.json()
    assert data["status"] == "ISSUED"
    assert data["is_overdue"] is False

    return_response = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )
    assert return_response.status_code == 200
    assert return_response.json()["status"] == "RETURNED"


def test_issue_sets_fourteen_day_due_date(
    client: TestClient,
    librarian_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Due date should be 14 days from issue date."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "inventory_code": catalog_book_with_copy["inventory_code"],
            "student_code": catalog_book_with_copy["student_code"],
        },
    )
    assert issue.status_code == 201
    issued_at = datetime.fromisoformat(issue.json()["issued_at"])
    due_at = date.fromisoformat(issue.json()["due_at"])
    assert due_at == (issued_at.date() + timedelta(days=settings.LOAN_PERIOD_DAYS))


def test_issue_second_copy_of_same_book_rejected(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """A student cannot hold two concurrent loans for the same book."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    first = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert first.status_code == 201

    second_copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    assert second_copy.status_code == 201

    blocked = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": second_copy.json()["id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert blocked.status_code == 409
    assert "already has an open loan" in blocked.json()["detail"].lower()


def test_reborrow_same_book_after_return_allowed(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Returning a book frees the student to borrow another copy of it."""
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
    assert issue.status_code == 201
    returned = client.post(
        "/api/v1/transactions/return",
        headers=lib_headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )
    assert returned.status_code == 200

    second_copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    assert second_copy.status_code == 201

    retry = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": second_copy.json()["id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert retry.status_code == 201


def test_issue_unavailable_copy_rejected(
    client: TestClient,
    librarian_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Cannot issue a copy that is not AVAILABLE."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    second_issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert second_issue.status_code == 409


def test_issue_blocked_by_unpaid_fine(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    catalog_book_with_copy: dict,
    db_session: Session,
) -> None:
    """Students with unpaid fines cannot receive additional loans."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    transaction_id = UUID(issue.json()["id"])

    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=3)
    db_session.flush()

    client.post(
        "/api/v1/transactions/return",
        headers=lib_headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )

    suffix_copy = client.post(
        "/api/v1/book-copies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"book_id": catalog_book_with_copy["book_id"]},
    ).json()

    blocked = client.post(
        "/api/v1/transactions/issue",
        headers=lib_headers,
        json={
            "book_copy_id": suffix_copy["id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert blocked.status_code == 409
    assert "unpaid fines" in blocked.json()["detail"].lower()


def test_overdue_return_creates_fine(
    client: TestClient,
    librarian_token: str,
    catalog_book_with_copy: dict,
    db_session: Session,
) -> None:
    """Returning late creates an unpaid fine."""
    headers = {"Authorization": f"Bearer {librarian_token}"}
    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    transaction_id = UUID(issue.json()["id"])

    transaction = db_session.get(Transaction, transaction_id)
    assert transaction is not None
    transaction.due_at = utc_today() - timedelta(days=2)
    db_session.flush()

    client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )

    fines = client.get(
        "/api/v1/fines",
        headers=headers,
        params={"student_id": catalog_book_with_copy["student_id"], "paid": False},
    )
    assert fines.status_code == 200
    assert fines.json()["total"] >= 1


def test_auto_generate_inventory_code(
    client: TestClient,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Book copy inventory code can be auto-generated."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    assert response.status_code == 201
    assert response.json()["inventory_code"].startswith("BK-")
