"""Dashboard endpoint tests."""

from fastapi.testclient import TestClient


def test_student_dashboard_access(client: TestClient, student_token: str) -> None:
    """Students can access their dashboard summary."""
    response = client.get(
        "/api/v1/dashboard/student",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "active_loans" in payload
    assert "active_reservations" in payload
    assert "unpaid_fines" in payload
    assert "total_books_borrowed" in payload
    assert isinstance(payload["recent_loans"], list)
    assert isinstance(payload["recent_reservations"], list)


def test_librarian_dashboard_access(client: TestClient, librarian_token: str) -> None:
    """Librarians can access the staff dashboard summary."""
    response = client.get(
        "/api/v1/dashboard/librarian",
        headers={"Authorization": f"Bearer {librarian_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["books_count"] >= 0
    assert payload["copies_count"] >= 0
    assert payload["active_loans"] >= 0
    assert payload["overdue_loans"] >= 0
    assert payload["reservations_count"] >= 0
    assert payload["unpaid_fines_count"] >= 0
    assert isinstance(payload["recent_transactions"], list)


def test_admin_dashboard_access(client: TestClient, admin_token: str) -> None:
    """Admins can access the admin dashboard summary."""
    response = client.get(
        "/api/v1/dashboard/admin",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["users_count"] >= 3
    assert payload["students_count"] >= 1
    assert payload["librarians_count"] >= 1
    assert payload["departments_count"] >= 1
    assert payload["books_count"] >= 0
    assert payload["active_loans"] >= 0
    assert isinstance(payload["recent_user_activity"], list)
    assert isinstance(payload["recent_circulation_activity"], list)


def test_dashboard_cross_role_forbidden(
    client: TestClient,
    admin_token: str,
    librarian_token: str,
    student_token: str,
) -> None:
    """Dashboard endpoints reject cross-role access."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    librarian_headers = {"Authorization": f"Bearer {librarian_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    assert client.get("/api/v1/dashboard/student", headers=admin_headers).status_code == 403
    assert client.get("/api/v1/dashboard/student", headers=librarian_headers).status_code == 403
    assert client.get("/api/v1/dashboard/librarian", headers=student_headers).status_code == 403
    assert client.get("/api/v1/dashboard/librarian", headers=admin_headers).status_code == 403
    assert client.get("/api/v1/dashboard/admin", headers=student_headers).status_code == 403
    assert client.get("/api/v1/dashboard/admin", headers=librarian_headers).status_code == 403


def test_student_dashboard_counts(
    client: TestClient,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Student dashboard reflects issued loans and returned history."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    before = client.get("/api/v1/dashboard/student", headers=student_headers).json()
    before_borrowed = before["total_books_borrowed"]

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert issue.status_code == 201

    during = client.get("/api/v1/dashboard/student", headers=student_headers).json()
    assert during["active_loans"] >= 1
    assert during["total_books_borrowed"] == before_borrowed + 1
    assert len(during["recent_loans"]) >= 1
    assert during["recent_loans"][0]["book_title"]

    client.post(
        "/api/v1/transactions/return",
        headers=admin_headers,
        json={"book_copy_id": catalog_book_with_copy["copy_id"]},
    )

    after = client.get("/api/v1/dashboard/student", headers=student_headers).json()
    assert after["active_loans"] == before["active_loans"]
    assert after["total_books_borrowed"] == before_borrowed + 1
