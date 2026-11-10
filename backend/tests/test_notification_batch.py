"""Checks for batching due and overdue reminder creation."""

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from app.repositories.notification_repository import NotificationRepository
from app.services.notification_service import NotificationService


def test_reminders_are_batched_with_correct_types_and_dates(monkeypatch) -> None:
    today = date(2026, 11, 10)
    monkeypatch.setattr("app.services.notification_service.utc_today", lambda: today)
    overdue_id, due_id, user_id = uuid4(), uuid4(), uuid4()
    db = MagicMock()
    db.execute.return_value.all.return_value = [
        (overdue_id, today - timedelta(days=2), "Overdue title"),
        (due_id, today + timedelta(days=2), "Due title"),
    ]
    service = NotificationService(db)
    service.repository = MagicMock()

    student = SimpleNamespace(id=user_id, role=SimpleNamespace(name="STUDENT"))
    service._create_loan_reminders(student)

    db.execute.assert_called_once()
    service.repository.create_many_once.assert_called_once()
    reminders = service.repository.create_many_once.call_args.args[0]
    assert [item["notification_type"] for item in reminders] == ["LOAN_OVERDUE", "DUE_SOON"]
    assert reminders[0]["event_key"] == f"loan-overdue:{overdue_id}:2026-11-08"
    assert reminders[1]["event_key"] == f"loan-due:{due_id}:2026-11-12"
    assert "12 Nov 2026" in reminders[1]["message"]


def test_batch_insert_ignores_duplicate_event_keys() -> None:
    db = MagicMock()
    repository = NotificationRepository(db)
    values = [
        {"user_id": uuid4(), "event_key": "event", "notification_type": "DUE_SOON",
         "title": "Due", "message": "Due soon", "link": None}
    ]

    repository.create_many_once(values)

    db.execute.assert_called_once()
    sql = str(db.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT ON CONSTRAINT uq_notifications_user_event_key DO NOTHING" in sql
