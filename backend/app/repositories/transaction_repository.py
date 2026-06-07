"""Transaction repository."""

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.book_copy import BookCopy
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.repositories.base import BaseRepository


class TransactionRepository(BaseRepository[Transaction]):
    """Database access for circulation transactions."""

    def __init__(self, db: Session) -> None:
        super().__init__(Transaction, db)

    def _with_relations(self):
        """Base select with eager-loaded relations."""
        return select(Transaction).options(
            selectinload(Transaction.book_copy).selectinload(BookCopy.book),
            selectinload(Transaction.student).selectinload(User.role),
            selectinload(Transaction.issuer).selectinload(User.role),
        )

    def get_by_id_with_relations(self, transaction_id: UUID) -> Transaction | None:
        """Fetch a transaction with related entities."""
        statement = self._with_relations().where(Transaction.id == transaction_id)
        return self.db.execute(statement).unique().scalar_one_or_none()

    def get_open_for_copy(self, book_copy_id: UUID) -> Transaction | None:
        """Return the open loan for a copy, if any."""
        statement = select(Transaction).where(
            Transaction.book_copy_id == book_copy_id,
            Transaction.status == TransactionStatus.ISSUED,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_open_for_copy_for_update(self, book_copy_id: UUID) -> Transaction | None:
        """Lock and return the open loan for a copy."""
        statement = (
            select(Transaction)
            .where(
                Transaction.book_copy_id == book_copy_id,
                Transaction.status == TransactionStatus.ISSUED,
            )
            .with_for_update()
        )
        return self.db.execute(statement).scalar_one_or_none()

    def has_open_loan_for_book(self, student_id: UUID, book_id: UUID) -> bool:
        """Return True if the student has an open loan on any copy of the book."""
        statement = (
            select(func.count())
            .select_from(Transaction)
            .join(BookCopy, Transaction.book_copy_id == BookCopy.id)
            .where(
                Transaction.student_id == student_id,
                Transaction.status == TransactionStatus.ISSUED,
                BookCopy.book_id == book_id,
            )
        )
        return self.db.execute(statement).scalar_one() > 0

    def list_transactions(
        self,
        *,
        page: int,
        page_size: int,
        student_id: UUID | None = None,
        status: TransactionStatus | None = None,
        overdue: bool | None = None,
        book_id: UUID | None = None,
    ) -> tuple[list[Transaction], int]:
        """Return paginated transactions with optional filters."""
        statement = self._with_relations()

        if student_id is not None:
            statement = statement.where(Transaction.student_id == student_id)
        if status is not None:
            statement = statement.where(Transaction.status == status)
        if overdue:
            statement = statement.where(
                Transaction.status == TransactionStatus.ISSUED,
                Transaction.due_at < date.today(),
            )
        if book_id is not None:
            statement = statement.join(BookCopy).where(BookCopy.book_id == book_id)

        count_stmt = select(func.count()).select_from(statement.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        statement = (
            statement.order_by(Transaction.issued_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).unique().scalars().all())
        return items, total

    def list_active_for_student(self, student_id: UUID) -> list[Transaction]:
        """Return open loans for a student ordered by due date."""
        statement = (
            self._with_relations()
            .where(
                Transaction.student_id == student_id,
                Transaction.status == TransactionStatus.ISSUED,
            )
            .order_by(Transaction.due_at.asc())
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def create(self, transaction: Transaction) -> Transaction:
        """Persist a new transaction."""
        self.db.add(transaction)
        self.db.flush()
        return transaction
