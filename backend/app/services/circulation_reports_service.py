"""Business logic for circulation reports."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.repositories.circulation_reports_repository import CirculationReportsRepository
from app.schemas.reports import (
    CirculationOverviewResponse,
    CirculationReportResponse,
    CirculationTrendPoint,
    DepartmentParticipationReport,
    InventoryPressureBook,
    InventoryStatusSummary,
    NoRecentLoanBook,
    PopularBookReport,
    PopularCategoryReport,
    ReservationTrendPoint,
)
from app.services.fine_service import FineService


def _period_start(value: date, interval: str) -> date:
    if interval == "week":
        return value - timedelta(days=value.weekday())
    if interval == "month":
        return value.replace(day=1)
    return value


def _money(value: Decimal) -> Decimal:
    """Keep report currency values at the API's two-decimal INR precision."""
    return value.quantize(Decimal("0.01"))


def _period_starts(start_date: date, end_date: date, interval: str) -> list[date]:
    current = _period_start(start_date, interval)
    last = _period_start(end_date, interval)
    periods: list[date] = []
    while current <= last:
        periods.append(current)
        if interval == "day":
            current += timedelta(days=1)
        elif interval == "week":
            current += timedelta(days=7)
        else:
            current = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
    return periods


class CirculationReportsService:
    """Build date-filtered circulation report summaries."""

    def __init__(self, db: Session) -> None:
        self.repository = CirculationReportsRepository(db)

    def get_overview(self) -> CirculationOverviewResponse:
        """Return only the metrics used by the admin dashboard."""
        end = utc_today()
        start = end - timedelta(days=29)
        FineService(self.repository.db).sync_open_overdue_fines()
        unpaid_balance, unpaid_count = self.repository.get_current_unpaid_fines()
        inventory = self.repository.get_inventory_insights(start, end)
        return CirculationOverviewResponse(
            loans_issued=self.repository.count_issues(start, end),
            returns_processed=self.repository.count_returns(start, end),
            overdue_at_period_end=self.repository.count_overdue_at_period_end(end),
            fines_collected=_money(self.repository.sum_fines_collected(start, end)),
            reservation_pressure_title_count=inventory.reservation_pressure_title_count,
            current_unpaid_fine_balance=_money(unpaid_balance),
            current_unpaid_fine_count=unpaid_count,
        )

    def get_report(
        self, *, start_date: date | None, end_date: date | None
    ) -> CirculationReportResponse:
        today = utc_today()
        resolved_end = end_date or today
        resolved_start = start_date or resolved_end - timedelta(days=29)

        if resolved_start > resolved_end:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Start date must be on or before end date.",
            )
        if resolved_end > today:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="End date cannot be in the future.",
            )

        # Match the fine screens and dashboards: refresh currently accruing balances
        # before reporting the current unpaid total.
        FineService(self.repository.db).sync_open_overdue_fines()

        period_length = (resolved_end - resolved_start).days + 1
        interval = "day" if period_length <= 45 else "week" if period_length <= 180 else "month"
        issue_totals, return_totals, fine_totals = self.repository.get_trend(
            resolved_start, resolved_end, interval
        )
        loans_issued = sum(issue_totals.values())
        returns_processed = sum(return_totals.values())
        fines_collected = sum(fine_totals.values(), Decimal("0.00"))
        (
            reservations_placed,
            reservations_fulfilled,
            reservations_expired,
            reservations_cancelled,
            average_reservation_wait_days,
        ) = self.repository.get_reservation_summary(resolved_start, resolved_end)
        reservation_placements, reservation_fulfillments = self.repository.get_reservation_trend(
            resolved_start, resolved_end, interval
        )
        periods = _period_starts(resolved_start, resolved_end, interval)
        trend = [
            CirculationTrendPoint(
                period_start=period,
                loans_issued=issue_totals.get(period, 0),
                returns_processed=return_totals.get(period, 0),
                fines_collected=_money(fine_totals.get(period, Decimal("0.00"))),
            )
            for period in periods
        ]
        reservation_trend = [
            ReservationTrendPoint(
                period_start=period,
                reservations_placed=reservation_placements.get(period, 0),
                reservations_fulfilled=reservation_fulfillments.get(period, 0),
            )
            for period in periods
        ]
        _, on_time_returns, late_returns, average_days_late = (
            self.repository.get_return_performance(resolved_start, resolved_end)
        )
        overdue_aging = self.repository.get_overdue_aging(resolved_end)
        current_unpaid_fine_balance, current_unpaid_fine_count = (
            self.repository.get_current_unpaid_fines()
        )
        current_unpaid_fine_balance = _money(current_unpaid_fine_balance)
        on_time_return_rate = (
            (Decimal(on_time_returns * 100) / Decimal(on_time_returns + late_returns)).quantize(
                Decimal("0.1")
            )
            if on_time_returns + late_returns
            else None
        )
        department_participation = [
            DepartmentParticipationReport(
                department_name=name,
                active_students=active_count,
                borrowing_students=borrower_count,
                participation_rate_percent=(
                    Decimal(borrower_count * 100) / Decimal(active_count)
                ).quantize(Decimal("0.1")),
                loans_issued=loan_count,
            )
            for name, active_count, borrower_count, loan_count in
            self.repository.list_department_participation(resolved_start, resolved_end)
        ]
        department_participation.sort(
            key=lambda item: (item.participation_rate_percent, -item.active_students)
        )
        inventory = self.repository.get_inventory_insights(resolved_start, resolved_end)

        return CirculationReportResponse(
            start_date=resolved_start,
            end_date=resolved_end,
            loans_issued=loans_issued,
            returns_processed=returns_processed,
            overdue_at_period_end=self.repository.count_overdue_at_period_end(resolved_end),
            fines_collected=_money(fines_collected),
            popular_books=[
                PopularBookReport(book_title=title, loans_issued=count)
                for title, count in self.repository.list_popular_books(
                    resolved_start, resolved_end
                )
            ],
            trend_interval=interval,
            trend=trend,
            reservations_placed=reservations_placed,
            reservations_fulfilled=reservations_fulfilled,
            reservations_expired=reservations_expired,
            reservations_cancelled=reservations_cancelled,
            average_reservation_wait_days=average_reservation_wait_days,
            reservation_trend=reservation_trend,
            popular_categories=[
                PopularCategoryReport(category_name=name, loans_issued=count)
                for name, count in self.repository.list_popular_categories(
                    resolved_start, resolved_end
                )
            ],
            on_time_returns=on_time_returns,
            late_returns=late_returns,
            on_time_return_rate_percent=on_time_return_rate,
            average_days_late=average_days_late,
            overdue_1_7_days_at_period_end=overdue_aging[0],
            overdue_8_30_days_at_period_end=overdue_aging[1],
            overdue_31_plus_days_at_period_end=overdue_aging[2],
            current_unpaid_fine_balance=current_unpaid_fine_balance,
            current_unpaid_fine_count=current_unpaid_fine_count,
            department_participation=department_participation,
            inventory_status=InventoryStatusSummary(
                total_copies=inventory.total_copies,
                available_copies=inventory.available_copies,
                borrowed_copies=inventory.borrowed_copies,
                reserved_copies=inventory.reserved_copies,
                out_of_service_copies=inventory.out_of_service_copies,
            ),
            reservation_pressure_title_count=inventory.reservation_pressure_title_count,
            reservation_pressure_books=[
                InventoryPressureBook(
                    book_title=title,
                    waiting_reservations=waiting,
                    available_copies=available,
                    reserved_copies=reserved,
                    loans_issued=loans,
                )
                for title, waiting, available, reserved, loans
                in inventory.reservation_pressure_books
            ],
            no_loan_title_count=inventory.no_loan_title_count,
            no_loan_books=[
                NoRecentLoanBook(book_title=title, available_copies=available)
                for title, available in inventory.no_loan_books
            ],
        )
