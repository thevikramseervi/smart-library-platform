"""Reservation queue awareness API tests for Sprint 4.3."""

import uuid

from fastapi.testclient import TestClient


def _create_unavailable_book(
    client: TestClient,
    admin_headers: dict[str, str],
    suffix: str,
) -> tuple[dict, str]:
    languages = client.get("/api/v1/languages", headers=admin_headers).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=admin_headers,
        json={"name": f"Awareness Publisher {suffix}"},
    ).json()
    book = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Awareness Book {suffix}",
            "publisher_id": publisher["id"],
            "language_id": english["id"],
        },
    ).json()
    copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={"book_id": book["id"], "inventory_code": f"INV-{suffix}"},
    ).json()
    client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"inventory_code": copy["inventory_code"], "student_code": "STU-001"},
    )
    return book, copy["id"]


def test_reservation_queue_includes_student_summary(
    client: TestClient,
    admin_token: str,
    student2_token: str,
) -> None:
    """Queue endpoint returns FIFO order with student identity for staff UX."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student2_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    book, _copy_id = _create_unavailable_book(client, admin_headers, suffix)

    created = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": book["id"]},
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["student"]["student_code"] == "STU-002"
    assert payload["student"]["first_name"]
    assert payload["student"]["last_name"]
    assert payload["queue_position"] == 1

    queue = client.get(
        f"/api/v1/reservations/queue/{book['id']}",
        headers=admin_headers,
    )
    assert queue.status_code == 200
    items = queue.json()
    assert len(items) == 1
    assert items[0]["queue_position"] == 1
    assert items[0]["student"]["student_code"] == "STU-002"
    assert items[0]["student"]["first_name"]
    assert items[0]["student"]["last_name"]


def test_reservation_queue_empty_after_return_without_reservations(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    """Returned books without a queue yield an empty queue response."""
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

    queue = client.get(
        f"/api/v1/reservations/queue/{catalog_book_with_copy['book_id']}",
        headers=admin_headers,
    )
    assert queue.status_code == 200
    assert queue.json() == []


def test_reservation_queue_visible_after_return_with_active_reservation(
    client: TestClient,
    librarian_token: str,
    admin_token: str,
    student2_token: str,
) -> None:
    """After return, staff can fetch the active queue for fulfillment."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student2_headers = {"Authorization": f"Bearer {student2_token}"}
    suffix = uuid.uuid4().hex[:8]
    book, copy_id = _create_unavailable_book(client, admin_headers, suffix)

    reservation = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": book["id"]},
    )
    assert reservation.status_code == 201

    returned = client.post(
        "/api/v1/transactions/return",
        headers=lib_headers,
        json={"book_copy_id": copy_id},
    )
    assert returned.status_code == 200

    queue = client.get(
        f"/api/v1/reservations/queue/{book['id']}",
        headers=admin_headers,
    )
    assert queue.status_code == 200
    assert len(queue.json()) == 1
    assert queue.json()[0]["student"]["student_code"] == "STU-002"
    assert queue.json()[0]["queue_position"] == 1
