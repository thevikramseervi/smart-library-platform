"""Administrator audit log endpoint and circulation event tests."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.services.audit_log_service import AuditLogService


def test_audit_log_record_keeps_actor_snapshot_without_committing() -> None:
    db = Mock()
    actor = SimpleNamespace(
        id=uuid4(),
        first_name="Dev",
        last_name="Librarian",
        email="librarian@library.local",
    )
    service = AuditLogService(db)

    event = service.record(
        actor=actor,
        action="BOOK_ISSUED",
        entity_type="TRANSACTION",
        entity_id=uuid4(),
        summary="Issued a title to a student",
        details={"inventory_code": "ACC-00001"},
    )

    db.add.assert_called_once_with(event)
    db.commit.assert_not_called()
    assert event.actor_name == "Dev Librarian"
    assert event.actor_email == "librarian@library.local"
    assert event.details == {"inventory_code": "ACC-00001"}


def test_system_audit_event_has_no_user_actor() -> None:
    db = Mock()
    service = AuditLogService(db)
    event = service.record(
        actor=None,
        action="RESERVATION_EXPIRED",
        entity_type="RESERVATION",
        entity_id=uuid4(),
        summary="Reservation expired",
    )

    assert event.actor_user_id is None
    assert event.actor_name == "System"
    assert event.actor_email == "system"
    db.add.assert_called_once_with(event)


def test_audit_logs_capture_issue_renewal_and_return(
    client: TestClient,
    admin_token: str,
    student_token: str,
    catalog_book_with_copy: dict,
) -> None:
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    copy = catalog_book_with_copy

    issued = client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"], "student_id": copy["student_id"]},
    )
    assert issued.status_code == 201
    transaction_id = issued.json()["id"]

    renewed = client.post(
        f"/api/v1/transactions/{transaction_id}/renew",
        headers=student_headers,
    )
    assert renewed.status_code == 200

    returned = client.post(
        "/api/v1/transactions/return",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"]},
    )
    assert returned.status_code == 200

    response = client.get(
        "/api/v1/audit-logs",
        headers=admin_headers,
        params={"q": copy["inventory_code"], "page_size": 10},
    )
    assert response.status_code == 200
    payload = response.json()
    circulation_events = [item for item in payload["items"] if item["entity_type"] == "TRANSACTION"]
    assert {item["action"] for item in circulation_events} == {
        "BOOK_ISSUED",
        "BOOK_RENEWED",
        "BOOK_RETURNED",
    }
    assert len(circulation_events) == 3
    assert all(item["actor_name"] for item in circulation_events)
    assert all(copy["inventory_code"] in item["summary"] for item in circulation_events)


def test_audit_logs_are_admin_only(
    client: TestClient,
    librarian_token: str,
    student_token: str,
) -> None:
    assert (
        client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {librarian_token}"},
        ).status_code
        == 403
    )


def test_audit_logs_capture_reservation_lifecycle(
    client: TestClient,
    db_session: Session,
    admin_token: str,
    student_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    student2_headers = {"Authorization": f"Bearer {student2_token}"}
    copy = catalog_book_with_copy

    unavailable = client.put(
        f"/api/v1/book-copies/{copy['copy_id']}",
        headers=admin_headers,
        json={"status": "DAMAGED"},
    )
    assert unavailable.status_code == 200
    first = client.post(
        "/api/v1/reservations",
        headers=student_headers,
        json={"book_id": copy["book_id"]},
    )
    assert first.status_code == 201
    reservation_id = first.json()["id"]

    available = client.put(
        f"/api/v1/book-copies/{copy['copy_id']}",
        headers=admin_headers,
        json={"status": "AVAILABLE"},
    )
    assert available.status_code == 200
    issued = client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"], "student_id": copy["student_id"]},
    )
    assert issued.status_code == 201

    second = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": copy["book_id"]},
    )
    assert second.status_code == 201
    cancelled = client.delete(
        f"/api/v1/reservations/{second.json()['id']}",
        headers=student2_headers,
    )
    assert cancelled.status_code == 204

    third = client.post(
        "/api/v1/reservations",
        headers=student2_headers,
        json={"book_id": copy["book_id"]},
    )
    assert third.status_code == 201
    stale = db_session.get(Reservation, third.json()["id"])
    assert stale is not None
    stale.expiry_date = datetime.now(UTC) - timedelta(days=1)
    db_session.flush()
    listed = client.get("/api/v1/reservations/me", headers=student2_headers)
    assert listed.status_code == 200

    response = client.get(
        "/api/v1/audit-logs",
        headers=admin_headers,
        params={"page_size": 100},
    )
    assert response.status_code == 200
    events = [event for event in response.json()["items"] if event["entity_type"] == "RESERVATION"]
    assert {event["action"] for event in events} >= {
        "RESERVATION_CREATED",
        "RESERVATION_CANCELLED",
        "RESERVATION_EXPIRED",
        "RESERVATION_FULFILLED",
    }
    expired = next(event for event in events if event["action"] == "RESERVATION_EXPIRED")
    assert expired["actor_user_id"] is None
    assert expired["actor_name"] == "System"
    assert any(
        event["action"] == "RESERVATION_FULFILLED" and event["entity_id"] == reservation_id
        for event in events
    )
    assert (
        client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {student_token}"},
        ).status_code
        == 403
    )


def test_audit_logs_capture_book_and_copy_changes(
    client: TestClient,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    copy = catalog_book_with_copy

    updated_copy = client.put(
        f"/api/v1/book-copies/{copy['copy_id']}",
        headers=headers,
        json={"location": "Audit test shelf"},
    )
    assert updated_copy.status_code == 200

    updated_book = client.put(
        f"/api/v1/books/{copy['book_id']}",
        headers=headers,
        json={"title": "Audit Test Updated Title"},
    )
    assert updated_book.status_code == 200

    retired_copy = client.put(
        f"/api/v1/book-copies/{copy['copy_id']}",
        headers=headers,
        json={"status": "RETIRED"},
    )
    assert retired_copy.status_code == 200

    deleted_book = client.delete(f"/api/v1/books/{copy['book_id']}", headers=headers)
    assert deleted_book.status_code == 204

    book_events = client.get(
        "/api/v1/audit-logs",
        headers=headers,
        params={"q": copy["book_id"], "page_size": 20},
    )
    assert book_events.status_code == 200
    book_actions = {event["action"] for event in book_events.json()["items"]}
    assert {"BOOK_CREATED", "BOOK_UPDATED", "BOOK_DELETED"} <= book_actions

    copy_events = client.get(
        "/api/v1/audit-logs",
        headers=headers,
        params={"q": copy["inventory_code"], "page_size": 20},
    )
    assert copy_events.status_code == 200
    copy_actions = {event["action"] for event in copy_events.json()["items"]}
    assert {"COPY_CREATED", "COPY_UPDATED"} <= copy_actions


def test_audit_logs_capture_user_changes_without_passwords(
    client: TestClient,
    admin_token: str,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    roles = client.get("/api/v1/roles", headers=headers)
    assert roles.status_code == 200
    librarian_role = next(role for role in roles.json() if role["name"] == "LIBRARIAN")
    suffix = uuid4().hex[:10]
    email = f"audit-user-{suffix}@library.local"
    initial_password = "initial-password-123"
    replacement_password = "replacement-password-456"

    created = client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "role_id": librarian_role["id"],
            "first_name": "Audit",
            "last_name": "User",
            "email": email,
            "password": initial_password,
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    updated = client.put(
        f"/api/v1/users/{user_id}",
        headers=headers,
        json={"first_name": "Updated Audit User"},
    )
    assert updated.status_code == 200

    reset = client.post(
        f"/api/v1/users/{user_id}/reset-password",
        headers=headers,
        json={"password": replacement_password},
    )
    assert reset.status_code == 204

    deactivated = client.delete(f"/api/v1/users/{user_id}", headers=headers)
    assert deactivated.status_code == 204

    events = client.get(
        "/api/v1/audit-logs",
        headers=headers,
        params={"q": user_id, "page_size": 20},
    )
    assert events.status_code == 200
    items = events.json()["items"]
    actions = {event["action"] for event in items}
    assert {
        "USER_CREATED",
        "USER_UPDATED",
        "USER_PASSWORD_RESET",
        "USER_DEACTIVATED",
    } <= actions
    serialized_events = str(items)
    assert initial_password not in serialized_events
    assert replacement_password not in serialized_events


def test_audit_logs_capture_department_and_reference_data_changes(
    client: TestClient,
    admin_token: str,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    suffix = uuid4().hex[:8]

    department = client.post(
        "/api/v1/departments",
        headers=headers,
        json={"name": f"Audit Department {suffix}", "code": f"A{suffix.upper()}"},
    )
    assert department.status_code == 201
    department_id = department.json()["id"]
    assert (
        client.put(
            f"/api/v1/departments/{department_id}",
            headers=headers,
            json={"name": f"Updated Audit Department {suffix}"},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/departments/{department_id}", headers=headers).status_code == 204

    author = client.post(
        "/api/v1/authors",
        headers=headers,
        json={"name": f"Audit Author {suffix}", "bio": "Original bio"},
    )
    assert author.status_code == 201
    author_id = author.json()["id"]
    assert (
        client.put(
            f"/api/v1/authors/{author_id}",
            headers=headers,
            json={"bio": "Updated bio"},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/authors/{author_id}", headers=headers).status_code == 204

    category = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": f"Audit Category {suffix}"},
    )
    assert category.status_code == 201
    category_id = category.json()["id"]
    assert (
        client.put(
            f"/api/v1/categories/{category_id}",
            headers=headers,
            json={"description": "Updated description"},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/categories/{category_id}", headers=headers).status_code == 204

    publisher = client.post(
        "/api/v1/publishers",
        headers=headers,
        json={"name": f"Audit Publisher {suffix}", "country": "India"},
    )
    assert publisher.status_code == 201
    publisher_id = publisher.json()["id"]
    assert (
        client.put(
            f"/api/v1/publishers/{publisher_id}",
            headers=headers,
            json={"country": "Nepal"},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/publishers/{publisher_id}", headers=headers).status_code == 204

    language = client.post(
        "/api/v1/languages",
        headers=headers,
        json={"name": f"Audit Language {suffix}", "code": f"L{suffix}"},
    )
    assert language.status_code == 201

    expected_actions = {
        department_id: {"DEPARTMENT_CREATED", "DEPARTMENT_UPDATED", "DEPARTMENT_DELETED"},
        author_id: {"AUTHOR_CREATED", "AUTHOR_UPDATED", "AUTHOR_DELETED"},
        category_id: {"CATEGORY_CREATED", "CATEGORY_UPDATED", "CATEGORY_DELETED"},
        publisher_id: {"PUBLISHER_CREATED", "PUBLISHER_UPDATED", "PUBLISHER_DELETED"},
        language.json()["id"]: {"LANGUAGE_CREATED"},
    }
    for entity_id, expected in expected_actions.items():
        response = client.get(
            "/api/v1/audit-logs",
            headers=headers,
            params={"q": entity_id, "page_size": 20},
        )
        assert response.status_code == 200
        assert expected <= {event["action"] for event in response.json()["items"]}
