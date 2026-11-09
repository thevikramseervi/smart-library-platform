"""Student loan renewal rules and endpoint permissions."""

from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.models.transaction import Transaction


def _create_another_book_with_copy(
    client: TestClient,
    admin_token: str,
) -> dict[str, str]:
    """Create a distinct title so one student can hold a second open loan."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(language for language in languages if language["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Renewal Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": f"Renewal Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book["id"], "inventory_code": f"REN-{suffix}"},
    ).json()
    return {"book_id": book["id"], "copy_id": copy["id"]}


def _issue(
    client: TestClient,
    admin_token: str,
    copy_id: str,
    student_id: str,
) -> dict:
    return client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"book_copy_id": copy_id, "student_id": student_id},
    ).json()


def test_student_can_renew_once_from_current_due_date(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """A successful renewal extends the existing due date and is counted."""
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    issued = _issue(client, admin_token, catalog_book_with_copy["copy_id"], student_id)
    old_due_date = date.fromisoformat(issued["due_at"])

    renewed = client.post(
        f"/api/v1/transactions/{issued['id']}/renew",
        headers=student_headers,
    )

    assert renewed.status_code == 200
    assert renewed.json()["due_at"] == (old_due_date + timedelta(days=14)).isoformat()
    assert renewed.json()["renewal_count"] == 1
    assert renewed.json()["max_renewals"] == 1

    active = client.get("/api/v1/transactions/me/active", headers=student_headers).json()
    active_loan = next(item for item in active if item["id"] == issued["id"])
    assert active_loan["due_at"] == renewed.json()["due_at"]
    repeated = client.post(
        f"/api/v1/transactions/{issued['id']}/renew",
        headers=student_headers,
    )
    assert repeated.status_code == 409
    assert "renewal limit" in repeated.json()["detail"].lower()

    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None and loan.renewal_count == 1


def test_overdue_loan_cannot_be_renewed(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    issued = _issue(client, admin_token, catalog_book_with_copy["copy_id"], student_id)
    loan = db_session.get(Transaction, issued["id"])
    assert loan is not None
    loan.due_at = utc_today() - timedelta(days=1)
    db_session.flush()

    response = client.post(
        f"/api/v1/transactions/{issued['id']}/renew",
        headers=student_headers,
    )

    assert response.status_code == 409
    assert "overdue" in response.json()["detail"].lower()


def test_admin_policy_can_disable_renewals(
    client: TestClient,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    policy = client.get("/api/v1/circulation-policies", headers=admin_headers).json()
    policy["max_renewals"] = 0
    updated = client.put("/api/v1/circulation-policies", headers=admin_headers, json=policy)
    assert updated.status_code == 200

    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    issued = _issue(client, admin_token, catalog_book_with_copy["copy_id"], student_id)
    response = client.post(
        f"/api/v1/transactions/{issued['id']}/renew",
        headers=student_headers,
    )

    assert response.status_code == 409
    assert "renewal limit" in response.json()["detail"].lower()


def test_reservation_queue_blocks_renewal(
    client: TestClient,
    admin_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    issued = _issue(client, admin_token, catalog_book_with_copy["copy_id"], student_id)
    reserved = client.post(
        "/api/v1/reservations",
        headers={"Authorization": f"Bearer {student2_token}"},
        json={"book_id": catalog_book_with_copy["book_id"]},
    )
    assert reserved.status_code == 201

    response = client.post(
        f"/api/v1/transactions/{issued['id']}/renew",
        headers=student_headers,
    )

    assert response.status_code == 409
    assert "reservation queue" in response.json()["detail"].lower()


def test_unpaid_fine_blocks_renewal(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    active_book = catalog_book_with_copy
    past_book = _create_another_book_with_copy(client, admin_token)
    active_loan = _issue(client, admin_token, active_book["copy_id"], student_id)
    past_loan = _issue(client, admin_token, past_book["copy_id"], student_id)

    overdue = db_session.get(Transaction, past_loan["id"])
    assert overdue is not None
    overdue.due_at = utc_today() - timedelta(days=1)
    db_session.flush()
    returned = client.post(
        "/api/v1/transactions/return",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"book_copy_id": past_book["copy_id"]},
    )
    assert returned.status_code == 200
    assert returned.json()["fine_amount"] is not None

    response = client.post(
        f"/api/v1/transactions/{active_loan['id']}/renew",
        headers=student_headers,
    )

    assert response.status_code == 409
    assert "unpaid fines" in response.json()["detail"].lower()


def test_only_owner_can_renew_and_nonstudents_are_forbidden(
    client: TestClient,
    admin_token: str,
    librarian_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student_id = client.get("/api/v1/auth/me", headers=student_headers).json()["id"]
    issued = _issue(client, admin_token, catalog_book_with_copy["copy_id"], student_id)
    path = f"/api/v1/transactions/{issued['id']}/renew"

    other_student = client.post(
        path,
        headers={"Authorization": f"Bearer {student2_token}"},
    )
    librarian = client.post(path, headers={"Authorization": f"Bearer {librarian_token}"})

    assert other_student.status_code == 404
    assert librarian.status_code == 403
