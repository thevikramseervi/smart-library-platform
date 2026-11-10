"""Fine repository."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from app.core.sql import contains_pattern
from app.models.book import Book
from app.models.book_copy import BookCopy
from app.models.fine import Fine
from app.models.transaction import Transaction
from app.models.user import User
from app.repositories.base import BaseRepository


class FineRepository(BaseRepository[Fine]):
    """Database access for fines."""

    def __init__(self, db: Session) -> None:
        super().__init__(Fine, db)

    @staticmethod
    def _with_relations():
        """Load the borrower and physical book copy for fine display."""
        return select(Fine).options(
            selectinload(Fine.transaction).selectinload(Transaction.student),
            selectinload(Fine.transaction)
            .selectinload(Transaction.book_copy)
            .selectinload(BookCopy.book),
        )

    def get_by_transaction_id(self, transaction_id: UUID) -> Fine | None:
        """Return a fine for a transaction, if any."""
        statement = select(Fine).where(Fine.transaction_id == transaction_id)
        return self.db.execute(statement).scalar_one_or_none()

    def mark_paid_if_unpaid(self, fine_id: UUID) -> int | None:
        """Atomically mark an unpaid fine paid.

        Returns the number of rows updated (0 when already paid), or None
        when the fine does not exist. The conditional UPDATE makes concurrent
        double-pay attempts deterministic instead of last-writer-wins.
        """
        exists = self.db.execute(select(Fine.id).where(Fine.id == fine_id)).scalar_one_or_none()
        if exists is None:
            return None
        statement = (
            update(Fine)
            .where(Fine.id == fine_id, Fine.paid.is_(False))
            .values(paid=True, paid_at=datetime.now(UTC))
        )
        result = self.db.execute(statement)
        return result.rowcount

    def has_unpaid_for_student(self, student_id: UUID) -> bool:
        """Return True if the student has any unpaid fine."""
        statement = (
            select(func.count())
            .select_from(Fine)
            .join(Transaction, Fine.transaction_id == Transaction.id)
            .where(
                Transaction.student_id == student_id,
                Fine.paid.is_(False),
                Fine.amount > Decimal("0"),
            )
        )
        return self.db.execute(statement).scalar_one() > 0

    def list_for_student(self, student_id: UUID) -> list[Fine]:
        """Return fines for a student."""
        statement = (
            self._with_relations()
            .join(Transaction, Fine.transaction_id == Transaction.id)
            .where(Transaction.student_id == student_id)
            .order_by(Fine.created_at.desc())
        )
        return list(self.db.execute(statement).scalars().all())

    def list_fines(
        self,
        *,
        page: int,
        page_size: int,
        paid: bool | None = None,
        student_id: UUID | None = None,
        q: str | None = None,
    ) -> tuple[list[Fine], int]:
        """Return paginated fines with optional filters."""
        statement = self._with_relations().join(Transaction, Fine.transaction_id == Transaction.id)
        if paid is not None:
            statement = statement.where(Fine.paid.is_(paid))
        if student_id is not None:
            statement = statement.where(Transaction.student_id == student_id)
        if q:
            pattern = contains_pattern(q)
            statement = (
                statement.join(BookCopy, Transaction.book_copy_id == BookCopy.id)
                .join(Book, BookCopy.book_id == Book.id)
                .join(User, Transaction.student_id == User.id)
                .where(
                    or_(
                        Book.title.ilike(pattern),
                        BookCopy.inventory_code.ilike(pattern),
                        User.first_name.ilike(pattern),
                        User.last_name.ilike(pattern),
                        User.student_code.ilike(pattern),
                        User.email.ilike(pattern),
                    )
                )
            )

        total = self.db.execute(select(func.count()).select_from(statement.subquery())).scalar_one()
        statement = (
            statement.order_by(Fine.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).scalars().all())
        return items, total

    def get_by_id(self, fine_id: UUID) -> Fine | None:
        """Fetch a fine by id."""
        statement = self._with_relations().where(Fine.id == fine_id)
        return self.db.execute(statement).scalar_one_or_none()

    def create(self, fine: Fine) -> Fine:
        """Persist a new fine."""
        self.db.add(fine)
        self.db.flush()
        return fine

    def save_accrued_many(self, accrued: list[tuple[UUID, Decimal, int]]) -> None:
        """Create or refresh overdue balances with one batched statement."""
        if not accrued:
            return

        statement = pg_insert(Fine).values(
            [
                {
                    "transaction_id": transaction_id,
                    "amount": amount,
                    "reason": f"Currently overdue: {days_late} day(s)",
                    "paid": False,
                }
                for transaction_id, amount, days_late in accrued
            ]
        )
        self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[Fine.transaction_id],
                set_={
                    "amount": statement.excluded.amount,
                    "reason": statement.excluded.reason,
                    "updated_at": func.now(),
                },
                # A paid fine must never become unpaid due to a concurrent refresh.
                where=Fine.paid.is_(False)
                & (
                    (Fine.amount != statement.excluded.amount)
                    | (Fine.reason != statement.excluded.reason)
                ),
            )
        )
