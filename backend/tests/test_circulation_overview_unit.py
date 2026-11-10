"""Tests for the lightweight admin dashboard overview."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.circulation_reports_service import CirculationReportsService


def test_overview_uses_last_30_days_and_only_summary_queries(monkeypatch) -> None:
    today = date(2026, 11, 11)
    monkeypatch.setattr("app.services.circulation_reports_service.utc_today", lambda: today)
    fine_service = MagicMock()
    monkeypatch.setattr(
        "app.services.circulation_reports_service.FineService", lambda _db: fine_service
    )
    service = CirculationReportsService(MagicMock())
    repo = MagicMock()
    repo.count_issues.return_value = 12
    repo.count_returns.return_value = 8
    repo.count_overdue_at_period_end.return_value = 2
    repo.sum_fines_collected.return_value = Decimal("25.00")
    repo.get_current_unpaid_fines.return_value = (Decimal("11.50"), 3)
    repo.get_inventory_insights.return_value = SimpleNamespace(reservation_pressure_title_count=4)
    service.repository = repo

    overview = service.get_overview()

    assert overview.loans_issued == 12
    assert overview.returns_processed == 8
    assert overview.overdue_at_period_end == 2
    assert overview.fines_collected == Decimal("25.00")
    assert overview.reservation_pressure_title_count == 4
    assert overview.current_unpaid_fine_balance == Decimal("11.50")
    assert overview.current_unpaid_fine_count == 3
    repo.count_issues.assert_called_once_with(date(2026, 10, 13), today)
    repo.get_inventory_insights.assert_called_once_with(date(2026, 10, 13), today)
    repo.get_trend.assert_not_called()
    fine_service.sync_open_overdue_fines.assert_called_once()
