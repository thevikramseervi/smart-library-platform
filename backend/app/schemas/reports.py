"""Circulation report response schemas."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class PopularBookReport(BaseModel):
    """A book and its number of issues during the report period."""

    book_title: str
    loans_issued: int


class CirculationTrendPoint(BaseModel):
    """Aggregated circulation activity for one day, week, or month."""

    period_start: date
    loans_issued: int
    returns_processed: int
    fines_collected: Decimal


class ReservationTrendPoint(BaseModel):
    """Reservation placements and fulfillments for one reporting period."""

    period_start: date
    reservations_placed: int
    reservations_fulfilled: int


class PopularCategoryReport(BaseModel):
    """Category issue totals; a loan may count in multiple categories."""

    category_name: str
    loans_issued: int


class DepartmentParticipationReport(BaseModel):
    """Aggregated borrowing participation for currently active students."""

    department_name: str
    active_students: int
    borrowing_students: int
    participation_rate_percent: Decimal
    loans_issued: int


class InventoryStatusSummary(BaseModel):
    """Current physical-copy counts grouped by circulation status."""

    total_copies: int
    available_copies: int
    borrowed_copies: int
    reserved_copies: int
    out_of_service_copies: int


class InventoryPressureBook(BaseModel):
    """A title where active demand exceeds unheld available copies."""

    book_title: str
    waiting_reservations: int
    available_copies: int
    reserved_copies: int
    loans_issued: int


class NoRecentLoanBook(BaseModel):
    """A title with available copies but no issues during the selected range."""

    book_title: str
    available_copies: int


class CirculationOverviewResponse(BaseModel):
    """Dashboard metrics for the most recent 30 UTC calendar days."""

    loans_issued: int
    returns_processed: int
    overdue_at_period_end: int
    fines_collected: Decimal
    reservation_pressure_title_count: int
    current_unpaid_fine_balance: Decimal
    current_unpaid_fine_count: int


class CirculationReportResponse(BaseModel):
    """Summary metrics for a selected circulation period."""

    start_date: date
    end_date: date
    loans_issued: int
    returns_processed: int
    overdue_at_period_end: int
    fines_collected: Decimal
    popular_books: list[PopularBookReport]
    trend_interval: Literal["day", "week", "month"]
    trend: list[CirculationTrendPoint]
    reservations_placed: int
    reservations_fulfilled: int
    reservations_expired: int
    reservations_cancelled: int
    average_reservation_wait_days: Decimal | None
    reservation_trend: list[ReservationTrendPoint]
    popular_categories: list[PopularCategoryReport]
    on_time_returns: int
    late_returns: int
    on_time_return_rate_percent: Decimal | None
    average_days_late: Decimal | None
    overdue_1_7_days_at_period_end: int
    overdue_8_30_days_at_period_end: int
    overdue_31_plus_days_at_period_end: int
    current_unpaid_fine_balance: Decimal
    current_unpaid_fine_count: int
    department_participation: list[DepartmentParticipationReport]
    inventory_status: InventoryStatusSummary
    reservation_pressure_title_count: int
    reservation_pressure_books: list[InventoryPressureBook]
    no_loan_title_count: int
    no_loan_books: list[NoRecentLoanBook]
