"""Read-only aggregate queries for circulation reports."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import Date, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.models.book import Book
from app.models.book_category import BookCategory
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.category import Category
from app.models.department import Department
from app.models.fine import Fine
from app.models.reservation import Reservation, ReservationStatus
from app.models.role import Role
from app.models.transaction import Transaction
from app.models.user import User


@dataclass(frozen=True)
class InventoryInsights:
    """Current copy mix and selected-period title-level inventory signals."""

    total_copies: int
    available_copies: int
    borrowed_copies: int
    reserved_copies: int
    out_of_service_copies: int
    reservation_pressure_title_count: int
    reservation_pressure_books: list[tuple[str, int, int, int, int]]
    no_loan_title_count: int
    no_loan_books: list[tuple[str, int]]


class CirculationReportsRepository:
    """Query circulation totals for a UTC calendar date range."""

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _range_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
        """Return inclusive-start, exclusive-end UTC timestamps."""
        start = datetime.combine(start_date, time.min, tzinfo=UTC)
        end_exclusive = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=UTC)
        return start, end_exclusive

    def count_issues(self, start_date: date, end_date: date) -> int:
        start, end_exclusive = self._range_bounds(start_date, end_date)
        statement = select(func.count()).select_from(Transaction).where(
            Transaction.issued_at >= start,
            Transaction.issued_at < end_exclusive,
        )
        return int(self.db.execute(statement).scalar_one())

    def count_returns(self, start_date: date, end_date: date) -> int:
        start, end_exclusive = self._range_bounds(start_date, end_date)
        statement = select(func.count()).select_from(Transaction).where(
            Transaction.returned_at >= start,
            Transaction.returned_at < end_exclusive,
        )
        return int(self.db.execute(statement).scalar_one())

    def count_overdue_at_period_end(self, end_date: date) -> int:
        statement = select(func.count()).select_from(Transaction).where(
            *self._overdue_at_period_end_conditions(end_date)
        )
        return int(self.db.execute(statement).scalar_one())

    def get_overdue_aging(self, end_date: date) -> tuple[int, int, int]:
        """Group overdue open loans into 1–7, 8–30, and 31+ day buckets."""
        days_1_7 = Transaction.due_at >= end_date - timedelta(days=7)
        days_31_plus = Transaction.due_at < end_date - timedelta(days=30)
        bucket_statement = select(
            func.count(Transaction.id).filter(days_1_7),
            func.count(Transaction.id).filter(
                Transaction.due_at < end_date - timedelta(days=7),
                Transaction.due_at >= end_date - timedelta(days=30),
            ),
            func.count(Transaction.id).filter(days_31_plus),
        ).where(*self._overdue_at_period_end_conditions(end_date))
        return tuple(int(value) for value in self.db.execute(bucket_statement).one())

    def _overdue_at_period_end_conditions(self, end_date: date):
        _, end_exclusive = self._range_bounds(end_date, end_date)
        still_open_at_end = (
            Transaction.returned_at.is_(None)
            if end_date == utc_today()
            else or_(Transaction.returned_at.is_(None), Transaction.returned_at >= end_exclusive)
        )
        return (
            Transaction.issued_at < end_exclusive,
            Transaction.due_at < end_date,
            still_open_at_end,
        )

    def get_return_performance(
        self, start_date: date, end_date: date
    ) -> tuple[int, int, int, Decimal | None]:
        """Return on-time/late totals and average days late for returned loans."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        returned_date = cast(func.timezone("UTC", Transaction.returned_at), Date)
        statement = select(
            func.count(Transaction.id),
            func.count(Transaction.id).filter(Transaction.due_at >= returned_date),
            func.count(Transaction.id).filter(Transaction.due_at < returned_date),
            func.avg(returned_date - Transaction.due_at).filter(
                Transaction.due_at < returned_date
            ),
        ).where(
            Transaction.returned_at >= start,
            Transaction.returned_at < end_exclusive,
        )
        result = self.db.execute(statement).one()
        average_days_late = Decimal(str(result[3])) if result[3] is not None else None
        return int(result[0]), int(result[1]), int(result[2]), average_days_late

    def get_current_unpaid_fines(self) -> tuple[Decimal, int]:
        """Return the current unpaid fine balance and number of unpaid records."""
        statement = select(
            func.coalesce(func.sum(Fine.amount), 0),
            func.count(Fine.id),
        ).where(Fine.paid.is_(False))
        amount, count = self.db.execute(statement).one()
        return Decimal(amount), int(count)

    def sum_fines_collected(self, start_date: date, end_date: date) -> Decimal:
        start, end_exclusive = self._range_bounds(start_date, end_date)
        statement = select(func.coalesce(func.sum(Fine.amount), 0)).where(
            Fine.paid.is_(True),
            Fine.paid_at >= start,
            Fine.paid_at < end_exclusive,
        )
        return Decimal(self.db.execute(statement).scalar_one())

    def list_popular_books(
        self, start_date: date, end_date: date, *, limit: int = 5
    ) -> list[tuple[str, int]]:
        start, end_exclusive = self._range_bounds(start_date, end_date)
        statement = (
            select(Book.title, func.count(Transaction.id).label("loans_issued"))
            .join(BookCopy, BookCopy.book_id == Book.id)
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(Transaction.issued_at >= start, Transaction.issued_at < end_exclusive)
            .group_by(Book.id, Book.title)
            .order_by(func.count(Transaction.id).desc(), Book.title.asc())
            .limit(limit)
        )
        return [(title, int(count)) for title, count in self.db.execute(statement).all()]

    def get_trend(
        self, start_date: date, end_date: date, interval: str
    ) -> tuple[dict[date, int], dict[date, int], dict[date, Decimal]]:
        """Return issue, return, and paid-fine totals grouped by UTC period."""
        start, end_exclusive = self._range_bounds(start_date, end_date)

        def grouped_totals(timestamp_column, where_conditions, aggregate):
            period = func.date_trunc(interval, func.timezone("UTC", timestamp_column))
            statement = (
                select(period.label("period_start"), aggregate)
                .where(*where_conditions)
                .group_by(period)
            )
            rows = self.db.execute(statement).all()
            return {row.period_start.date(): row[1] for row in rows}

        issues = grouped_totals(
            Transaction.issued_at,
            (Transaction.issued_at >= start, Transaction.issued_at < end_exclusive),
            func.count(),
        )
        returns = grouped_totals(
            Transaction.returned_at,
            (Transaction.returned_at >= start, Transaction.returned_at < end_exclusive),
            func.count(),
        )
        fines = grouped_totals(
            Fine.paid_at,
            (
                Fine.paid.is_(True),
                Fine.paid_at >= start,
                Fine.paid_at < end_exclusive,
            ),
            func.sum(Fine.amount),
        )
        return (
            {period: int(total) for period, total in issues.items()},
            {period: int(total) for period, total in returns.items()},
            {period: Decimal(total or 0) for period, total in fines.items()},
        )

    def get_reservation_summary(
        self, start_date: date, end_date: date
    ) -> tuple[int, int, int, int, Decimal | None]:
        """Return placement and final-state totals in the selected range."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        placed = self.db.execute(
            select(func.count())
            .select_from(Reservation)
            .where(
                Reservation.reservation_date >= start,
                Reservation.reservation_date < end_exclusive,
            )
        ).scalar_one()
        outcomes = self.db.execute(
            select(
                func.count(Reservation.id)
                .filter(Reservation.status == ReservationStatus.FULFILLED),
                func.count(Reservation.id)
                .filter(Reservation.status == ReservationStatus.EXPIRED),
                func.count(Reservation.id)
                .filter(Reservation.status == ReservationStatus.CANCELLED),
                func.avg(
                    # App and database clocks can differ slightly; elapsed time
                    # cannot be negative, so clamp each fulfilled wait at zero.
                    func.greatest(
                        func.extract(
                            "epoch", Reservation.updated_at - Reservation.reservation_date
                        ),
                        0,
                    )
                    / 86400
                ).filter(Reservation.status == ReservationStatus.FULFILLED),
            ).where(
                Reservation.updated_at >= start,
                Reservation.updated_at < end_exclusive,
                Reservation.status != ReservationStatus.ACTIVE,
            )
        ).one()
        average_wait = Decimal(str(outcomes[3])) if outcomes[3] is not None else None
        return int(placed), int(outcomes[0]), int(outcomes[1]), int(outcomes[2]), average_wait

    def get_reservation_trend(
        self, start_date: date, end_date: date, interval: str
    ) -> tuple[dict[date, int], dict[date, int]]:
        """Return reservation placements and fulfillments grouped by UTC period."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        placement_period = func.date_trunc(
            interval, func.timezone("UTC", Reservation.reservation_date)
        )
        placements = self.db.execute(
            select(placement_period.label("period_start"), func.count())
            .where(
                Reservation.reservation_date >= start,
                Reservation.reservation_date < end_exclusive,
            )
            .group_by(placement_period)
        ).all()
        outcome_period = func.date_trunc(interval, func.timezone("UTC", Reservation.updated_at))
        outcomes = self.db.execute(
            select(
                outcome_period.label("period_start"),
                func.count(Reservation.id).filter(
                    Reservation.status == ReservationStatus.FULFILLED
                ),
            )
            .where(
                Reservation.updated_at >= start,
                Reservation.updated_at < end_exclusive,
                Reservation.status == ReservationStatus.FULFILLED,
            )
            .group_by(outcome_period)
        ).all()
        return (
            {row.period_start.date(): int(row[1]) for row in placements},
            {row.period_start.date(): int(row[1]) for row in outcomes},
        )

    def list_popular_categories(
        self, start_date: date, end_date: date, *, limit: int = 5
    ) -> list[tuple[str, int]]:
        """Return current catalog categories ordered by issue count."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        statement = (
            select(Category.name, func.count(Transaction.id).label("loans_issued"))
            .join(BookCategory, BookCategory.category_id == Category.id)
            .join(Book, Book.id == BookCategory.book_id)
            .join(BookCopy, BookCopy.book_id == Book.id)
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(
                Category.deleted_at.is_(None),
                Transaction.issued_at >= start,
                Transaction.issued_at < end_exclusive,
            )
            .group_by(Category.id, Category.name)
            .order_by(func.count(Transaction.id).desc(), Category.name.asc())
            .limit(limit)
        )
        return [(name, int(count)) for name, count in self.db.execute(statement).all()]

    def list_department_participation(
        self, start_date: date, end_date: date
    ) -> list[tuple[str, int, int, int]]:
        """Return participation and loan totals for each department's active students."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        active_students = (
            select(
                User.department_id.label("department_id"),
                func.count(User.id).label("active_students"),
            )
            .join(Role, Role.id == User.role_id)
            .where(
                Role.name == "STUDENT",
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                User.department_id.is_not(None),
            )
            .group_by(User.department_id)
            .subquery()
        )
        borrowing_activity = (
            select(
                User.department_id.label("department_id"),
                func.count(func.distinct(Transaction.student_id)).label("borrowing_students"),
                func.count(Transaction.id).label("loans_issued"),
            )
            .join(Role, Role.id == User.role_id)
            .join(Transaction, Transaction.student_id == User.id)
            .where(
                Role.name == "STUDENT",
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                User.department_id.is_not(None),
                Transaction.issued_at >= start,
                Transaction.issued_at < end_exclusive,
            )
            .group_by(User.department_id)
            .subquery()
        )
        statement = (
            select(
                Department.name,
                active_students.c.active_students,
                func.coalesce(borrowing_activity.c.borrowing_students, 0),
                func.coalesce(borrowing_activity.c.loans_issued, 0),
            )
            .join(active_students, active_students.c.department_id == Department.id)
            .outerjoin(
                borrowing_activity,
                borrowing_activity.c.department_id == Department.id,
            )
            .order_by(Department.name.asc())
        )
        return [
            (name, int(active_count), int(borrower_count), int(loan_count))
            for name, active_count, borrower_count, loan_count in self.db.execute(statement).all()
        ]

    def get_inventory_insights(
        self, start_date: date, end_date: date, *, limit: int = 5
    ) -> InventoryInsights:
        """Summarize current copy status, queue pressure, and zero-issue titles."""
        start, end_exclusive = self._range_bounds(start_date, end_date)
        copy_counts = (
            select(
                BookCopy.book_id.label("book_id"),
                func.count(BookCopy.id).label("total_copies"),
                func.count(BookCopy.id)
                .filter(BookCopy.status == BookCopyStatus.AVAILABLE)
                .label("available_copies"),
                func.count(BookCopy.id)
                .filter(BookCopy.status == BookCopyStatus.BORROWED)
                .label("borrowed_copies"),
                func.count(BookCopy.id)
                .filter(BookCopy.status == BookCopyStatus.RESERVED)
                .label("reserved_copies"),
                func.count(BookCopy.id)
                .filter(
                    BookCopy.status.in_(
                        [
                            BookCopyStatus.LOST,
                            BookCopyStatus.DAMAGED,
                            BookCopyStatus.RETIRED,
                        ]
                    )
                )
                .label("out_of_service_copies"),
            )
            .join(Book, Book.id == BookCopy.book_id)
            .where(Book.deleted_at.is_(None))
            .group_by(BookCopy.book_id)
            .subquery()
        )
        active_reservations = (
            select(
                Reservation.book_id.label("book_id"),
                func.count(Reservation.id).label("active_reservations"),
            )
            .where(Reservation.status == ReservationStatus.ACTIVE)
            .group_by(Reservation.book_id)
            .subquery()
        )
        issue_counts = (
            select(
                BookCopy.book_id.label("book_id"),
                func.count(Transaction.id).label("loans_issued"),
            )
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(Transaction.issued_at >= start, Transaction.issued_at < end_exclusive)
            .group_by(BookCopy.book_id)
            .subquery()
        )
        statement = (
            select(
                Book.title,
                func.coalesce(copy_counts.c.total_copies, 0),
                func.coalesce(copy_counts.c.available_copies, 0),
                func.coalesce(copy_counts.c.borrowed_copies, 0),
                func.coalesce(copy_counts.c.reserved_copies, 0),
                func.coalesce(copy_counts.c.out_of_service_copies, 0),
                func.coalesce(active_reservations.c.active_reservations, 0),
                func.coalesce(issue_counts.c.loans_issued, 0),
            )
            .outerjoin(copy_counts, copy_counts.c.book_id == Book.id)
            .outerjoin(active_reservations, active_reservations.c.book_id == Book.id)
            .outerjoin(issue_counts, issue_counts.c.book_id == Book.id)
            .where(Book.deleted_at.is_(None))
        )
        rows = self.db.execute(statement).all()

        totals = [0, 0, 0, 0, 0]
        pressure: list[tuple[str, int, int, int, int]] = []
        unused: list[tuple[str, int]] = []
        for (
            title,
            total,
            available,
            borrowed,
            reserved,
            out_of_service,
            active_queue,
            loans,
        ) in rows:
            totals = [
                current + int(value)
                for current, value in zip(
                    totals, (total, available, borrowed, reserved, out_of_service), strict=True
                )
            ]
            waiting = max(0, int(active_queue) - int(reserved))
            if waiting > int(available):
                pressure.append(
                    (title, waiting, int(available), int(reserved), int(loans))
                )
            if int(available) > 0 and int(loans) == 0 and int(active_queue) == 0:
                unused.append((title, int(available)))

        pressure.sort(key=lambda row: (-(row[1] - row[2]), -row[1], row[0].casefold()))
        unused.sort(key=lambda row: (-row[1], row[0].casefold()))
        return InventoryInsights(
            total_copies=totals[0],
            available_copies=totals[1],
            borrowed_copies=totals[2],
            reserved_copies=totals[3],
            out_of_service_copies=totals[4],
            reservation_pressure_title_count=len(pressure),
            reservation_pressure_books=pressure[:limit],
            no_loan_title_count=len(unused),
            no_loan_books=unused[:limit],
        )
