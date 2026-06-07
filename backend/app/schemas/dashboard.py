"""Dashboard response schemas."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class StudentRecentLoan(BaseModel):
    """Recent loan row for the student dashboard."""

    book_title: str
    issued_at: datetime
    due_at: date
    status: str
    is_overdue: bool


class StudentRecentReservation(BaseModel):
    """Recent reservation row for the student dashboard."""

    book_title: str
    queue_position: int | None
    reservation_date: datetime


class StudentDashboardResponse(BaseModel):
    """Student dashboard summary."""

    active_loans: int
    active_reservations: int
    unpaid_fines: Decimal
    total_books_borrowed: int
    recent_loans: list[StudentRecentLoan]
    recent_reservations: list[StudentRecentReservation]


class LibrarianRecentTransaction(BaseModel):
    """Recent circulation event for the librarian dashboard."""

    book_title: str
    student_name: str
    student_code: str | None
    action: str
    occurred_at: datetime


class LibrarianDashboardResponse(BaseModel):
    """Librarian dashboard summary."""

    books_count: int
    copies_count: int
    active_loans: int
    overdue_loans: int
    reservations_count: int
    unpaid_fines_count: int
    recent_transactions: list[LibrarianRecentTransaction]


class AdminUserActivity(BaseModel):
    """Recent user lifecycle event for the admin dashboard."""

    activity_type: str
    user_name: str
    email: str
    role_name: str
    occurred_at: datetime


class AdminCirculationActivity(BaseModel):
    """Recent circulation event for the admin dashboard."""

    action: str
    book_title: str
    student_name: str
    occurred_at: datetime


class AdminDashboardResponse(BaseModel):
    """Admin dashboard summary."""

    users_count: int
    students_count: int
    librarians_count: int
    departments_count: int
    books_count: int
    active_loans: int
    recent_user_activity: list[AdminUserActivity]
    recent_circulation_activity: list[AdminCirculationActivity]
