"""Per-student concurrent-loan limit tests."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings


def _create_book_with_copy(client: TestClient, headers: dict) -> str:
    suffix = uuid.uuid4().hex[:8]
    languages = client.get("/api/v1/languages", headers=headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"LoanLimit Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={
            "title": f"LoanLimit Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=headers,
        json={"book_id": book["id"], "inventory_code": f"LOANLMT-{suffix}"},
    ).json()
    return copy["id"]


def test_student_cannot_exceed_active_loan_limit(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
) -> None:
    """Issuing beyond MAX_ACTIVE_LOANS is rejected with 409."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {student_token}"},
    ).json()

    issued = 0
    last_response = None
    for _ in range(settings.MAX_ACTIVE_LOANS + 1):
        copy_id = _create_book_with_copy(client, headers)
        last_response = client.post(
            "/api/v1/transactions/issue",
            headers=headers,
            json={"book_copy_id": copy_id, "student_id": me["id"]},
        )
        if last_response.status_code == 201:
            issued += 1

    assert issued == settings.MAX_ACTIVE_LOANS
    assert last_response is not None
    assert last_response.status_code == 409
    assert "concurrent loans" in last_response.json()["detail"]
