"""Dashboard aggregate queries."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.book_copy import BookCopy
from app.models.department import Department
from app.models.fine import Fine
from app.models.reservation import Reservation, ReservationStatus
from app.models.role import Role
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User


class DashboardRepository:
    """Read-only queries for role-based dashboards."""

    RECENT_LIMIT = 5

    def __init__(self, db: Session) -> None:
        self.db = db

    def count_active_loans_for_student(self, student_id: UUID) -> int:
        """Count open loans for a student."""
        statement = (
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.student_id == student_id,
                Transaction.status == TransactionStatus.ISSUED,
            )
        )
        return int(self.db.execute(statement).scalar_one())

    def count_active_reservations_for_student(self, student_id: UUID) -> int:
        """Count active reservations for a student."""
        statement = (
            select(func.count())
            .select_from(Reservation)
            .where(
                Reservation.student_id == student_id,
                Reservation.status == ReservationStatus.ACTIVE,
            )
        )
        return int(self.db.execute(statement).scalar_one())

    def sum_unpaid_fines_for_student(self, student_id: UUID) -> Decimal:
        """Sum unpaid fine amounts for a student."""
        statement = (
            select(func.coalesce(func.sum(Fine.amount), 0))
            .select_from(Fine)
            .join(Transaction, Fine.transaction_id == Transaction.id)
            .where(Transaction.student_id == student_id, Fine.paid.is_(False))
        )
        return Decimal(self.db.execute(statement).scalar_one())

    def count_total_borrowed_for_student(self, student_id: UUID) -> int:
        """Count all loans ever issued to a student."""
        statement = (
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.student_id == student_id)
        )
        return int(self.db.execute(statement).scalar_one())

    def list_recent_loans_for_student(self, student_id: UUID) -> list[Transaction]:
        """Return recent loans for a student."""
        statement = (
            select(Transaction)
            .options(selectinload(Transaction.book_copy).selectinload(BookCopy.book))
            .where(Transaction.student_id == student_id)
            .order_by(Transaction.issued_at.desc())
            .limit(self.RECENT_LIMIT)
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def list_recent_reservations_for_student(self, student_id: UUID) -> list[Reservation]:
        """Return recent active reservations for a student."""
        statement = (
            select(Reservation)
            .options(selectinload(Reservation.book))
            .where(
                Reservation.student_id == student_id,
                Reservation.status == ReservationStatus.ACTIVE,
            )
            .order_by(Reservation.reservation_date.desc())
            .limit(self.RECENT_LIMIT)
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def count_active_reservations(self) -> int:
        """Count all active reservations."""
        statement = (
            select(func.count())
            .select_from(Reservation)
            .where(Reservation.status == ReservationStatus.ACTIVE)
        )
        return int(self.db.execute(statement).scalar_one())

    def count_books(self) -> int:
        """Count non-deleted books."""
        statement = select(func.count()).select_from(Book).where(Book.deleted_at.is_(None))
        return int(self.db.execute(statement).scalar_one())

    def count_copies(self) -> int:
        """Count all book copies."""
        statement = select(func.count()).select_from(BookCopy)
        return int(self.db.execute(statement).scalar_one())

    def count_active_loans(self) -> int:
        """Count open loans."""
        statement = (
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.status == TransactionStatus.ISSUED)
        )
        return int(self.db.execute(statement).scalar_one())

    def count_overdue_loans(self) -> int:
        """Count overdue open loans."""
        statement = (
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.status == TransactionStatus.ISSUED,
                Transaction.due_at < date.today(),
            )
        )
        return int(self.db.execute(statement).scalar_one())

    def count_unpaid_fines(self) -> int:
        """Count unpaid fines."""
        statement = select(func.count()).select_from(Fine).where(Fine.paid.is_(False))
        return int(self.db.execute(statement).scalar_one())

    def list_recent_transactions(self) -> list[Transaction]:
        """Return recent circulation transactions."""
        statement = (
            select(Transaction)
            .options(
                selectinload(Transaction.book_copy).selectinload(BookCopy.book),
                selectinload(Transaction.student),
            )
            .order_by(Transaction.issued_at.desc())
            .limit(self.RECENT_LIMIT)
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def count_users(self) -> int:
        """Count non-deleted users."""
        statement = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        return int(self.db.execute(statement).scalar_one())

    def count_users_by_role(self, role_name: str) -> int:
        """Count non-deleted users with a role."""
        statement = (
            select(func.count())
            .select_from(User)
            .join(Role, User.role_id == Role.id)
            .where(User.deleted_at.is_(None), Role.name == role_name)
        )
        return int(self.db.execute(statement).scalar_one())

    def count_departments(self) -> int:
        """Count departments."""
        statement = select(func.count()).select_from(Department)
        return int(self.db.execute(statement).scalar_one())

    def list_recent_created_users(self) -> list[User]:
        """Return recently created non-deleted users."""
        statement = (
            select(User)
            .options(selectinload(User.role))
            .where(User.deleted_at.is_(None))
            .order_by(User.created_at.desc())
            .limit(self.RECENT_LIMIT)
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def list_recent_deactivated_users(self) -> list[User]:
        """Return recently soft-deleted users."""
        statement = (
            select(User)
            .options(selectinload(User.role))
            .where(User.deleted_at.is_not(None))
            .order_by(User.deleted_at.desc())
            .limit(self.RECENT_LIMIT)
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def compute_queue_position(self, reservation: Reservation) -> int | None:
        """Return 1-based queue position for an active reservation."""
        if reservation.status != ReservationStatus.ACTIVE:
            return None
        statement = (
            select(func.count())
            .select_from(Reservation)
            .where(
                Reservation.book_id == reservation.book_id,
                Reservation.status == ReservationStatus.ACTIVE,
                Reservation.reservation_date < reservation.reservation_date,
            )
        )
        earlier = int(self.db.execute(statement).scalar_one())
        return earlier + 1

    @staticmethod
    def _student_name(user: User) -> str:
        """Format a student's display name."""
        return f"{user.first_name} {user.last_name}"

    @staticmethod
    def _transaction_occurred_at(transaction: Transaction) -> datetime:
        """Return the most relevant timestamp for a transaction event."""
        if transaction.status == TransactionStatus.RETURNED and transaction.returned_at:
            return transaction.returned_at
        return transaction.issued_at

    @staticmethod
    def _transaction_action(transaction: Transaction) -> str:
        """Map transaction status to dashboard action label."""
        return "RETURN" if transaction.status == TransactionStatus.RETURNED else "ISSUE"

    @staticmethod
    def _is_overdue(transaction: Transaction) -> bool:
        """Return True when an issued loan is overdue."""
        return (
            transaction.status == TransactionStatus.ISSUED
            and transaction.due_at < date.today()
        )
