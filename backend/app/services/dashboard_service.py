"""Dashboard business logic."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import (
    AdminCirculationActivity,
    AdminDashboardResponse,
    AdminUserActivity,
    LibrarianDashboardResponse,
    LibrarianRecentTransaction,
    StudentDashboardResponse,
    StudentRecentLoan,
    StudentRecentReservation,
)


class DashboardService:
    """Service layer for role-based dashboard summaries."""

    def __init__(self, db: Session) -> None:
        self.repository = DashboardRepository(db)

    def get_student_dashboard(self, student: User) -> StudentDashboardResponse:
        """Build the student dashboard summary."""
        recent_loans = [
            StudentRecentLoan(
                book_title=transaction.book_copy.book.title,
                issued_at=transaction.issued_at,
                due_at=transaction.due_at,
                status=transaction.status.value,
                is_overdue=self.repository._is_overdue(transaction),
            )
            for transaction in self.repository.list_recent_loans_for_student(student.id)
        ]
        recent_reservations = [
            StudentRecentReservation(
                book_title=reservation.book.title,
                queue_position=self.repository.compute_queue_position(reservation),
                reservation_date=reservation.reservation_date,
            )
            for reservation in self.repository.list_recent_reservations_for_student(student.id)
        ]

        return StudentDashboardResponse(
            active_loans=self.repository.count_active_loans_for_student(student.id),
            active_reservations=self.repository.count_active_reservations_for_student(student.id),
            unpaid_fines=self.repository.sum_unpaid_fines_for_student(student.id),
            total_books_borrowed=self.repository.count_total_borrowed_for_student(student.id),
            recent_loans=recent_loans,
            recent_reservations=recent_reservations,
        )

    def get_librarian_dashboard(self) -> LibrarianDashboardResponse:
        """Build the librarian dashboard summary."""
        recent_transactions = [
            LibrarianRecentTransaction(
                book_title=transaction.book_copy.book.title,
                student_name=self.repository._student_name(transaction.student),
                student_code=transaction.student.student_code,
                action=self.repository._transaction_action(transaction),
                occurred_at=self.repository._transaction_occurred_at(transaction),
            )
            for transaction in self.repository.list_recent_transactions()
        ]

        return LibrarianDashboardResponse(
            books_count=self.repository.count_books(),
            copies_count=self.repository.count_copies(),
            active_loans=self.repository.count_active_loans(),
            overdue_loans=self.repository.count_overdue_loans(),
            reservations_count=self.repository.count_active_reservations(),
            unpaid_fines_count=self.repository.count_unpaid_fines(),
            recent_transactions=recent_transactions,
        )

    def get_admin_dashboard(self) -> AdminDashboardResponse:
        """Build the admin dashboard summary."""
        created_activity = [
            AdminUserActivity(
                activity_type="CREATED",
                user_name=self.repository._student_name(user),
                email=user.email,
                role_name=user.role.name,
                occurred_at=user.created_at,
            )
            for user in self.repository.list_recent_created_users()
        ]
        deactivated_activity = [
            AdminUserActivity(
                activity_type="DEACTIVATED",
                user_name=self.repository._student_name(user),
                email=user.email,
                role_name=user.role.name,
                occurred_at=user.deleted_at,
            )
            for user in self.repository.list_recent_deactivated_users()
            if user.deleted_at is not None
        ]
        recent_user_activity = sorted(
            [*created_activity, *deactivated_activity],
            key=lambda item: item.occurred_at,
            reverse=True,
        )[: self.repository.RECENT_LIMIT]

        recent_circulation_activity = [
            AdminCirculationActivity(
                action=self.repository._transaction_action(transaction),
                book_title=transaction.book_copy.book.title,
                student_name=self.repository._student_name(transaction.student),
                occurred_at=self.repository._transaction_occurred_at(transaction),
            )
            for transaction in self.repository.list_recent_transactions()
        ]

        return AdminDashboardResponse(
            users_count=self.repository.count_users(),
            students_count=self.repository.count_users_by_role("STUDENT"),
            librarians_count=self.repository.count_users_by_role("LIBRARIAN"),
            departments_count=self.repository.count_departments(),
            books_count=self.repository.count_books(),
            active_loans=self.repository.count_active_loans(),
            recent_user_activity=recent_user_activity,
            recent_circulation_activity=recent_circulation_activity,
        )
