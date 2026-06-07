"""Circulation RBAC tests."""

from fastapi.testclient import TestClient

from tests.conftest_circulation import catalog_book_with_copy  # noqa: F401


def test_student_cannot_issue(
    client: TestClient,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Students cannot issue books."""
    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert response.status_code == 403


def test_librarian_can_issue(
    client: TestClient,
    librarian_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Librarians can issue books."""
    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {librarian_token}"},
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert response.status_code == 201


def test_student_active_loans_endpoint(
    client: TestClient,
    librarian_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Student can view active loans via /transactions/me/active."""
    client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {librarian_token}"},
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )

    response = client.get(
        "/api/v1/transactions/me/active",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 200
    matching = [
        loan for loan in response.json()
        if loan["book_copy_id"] == catalog_book_with_copy["copy_id"]
    ]
    assert len(matching) == 1
    assert matching[0]["status"] == "ISSUED"


def test_student_cannot_view_other_student_transactions(
    client: TestClient,
    student_token: str,
) -> None:
    """Student cannot access the staff transaction list endpoint."""
    response = client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {student_token}"},
        params={"student_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 403
