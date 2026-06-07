"""Fine repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.fine import Fine
from app.models.transaction import Transaction
from app.repositories.base import BaseRepository


class FineRepository(BaseRepository[Fine]):
    """Database access for fines."""

    def __init__(self, db: Session) -> None:
        super().__init__(Fine, db)

    def get_by_transaction_id(self, transaction_id: UUID) -> Fine | None:
        """Return a fine for a transaction, if any."""
        statement = select(Fine).where(Fine.transaction_id == transaction_id)
        return self.db.execute(statement).scalar_one_or_none()

    def has_unpaid_for_student(self, student_id: UUID) -> bool:
        """Return True if the student has any unpaid fine."""
        statement = (
            select(func.count())
            .select_from(Fine)
            .join(Transaction, Fine.transaction_id == Transaction.id)
            .where(
                Transaction.student_id == student_id,
                Fine.paid.is_(False),
            )
        )
        return self.db.execute(statement).scalar_one() > 0

    def list_for_student(self, student_id: UUID) -> list[Fine]:
        """Return fines for a student."""
        statement = (
            select(Fine)
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
    ) -> tuple[list[Fine], int]:
        """Return paginated fines with optional filters."""
        statement = select(Fine).join(Transaction, Fine.transaction_id == Transaction.id)
        if paid is not None:
            statement = statement.where(Fine.paid.is_(paid))
        if student_id is not None:
            statement = statement.where(Transaction.student_id == student_id)

        total = self.db.execute(
            select(func.count()).select_from(statement.subquery())
        ).scalar_one()
        statement = (
            statement.order_by(Fine.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).scalars().all())
        return items, total

    def get_by_id(self, fine_id: UUID) -> Fine | None:
        """Fetch a fine by id."""
        statement = (
            select(Fine)
            .options(selectinload(Fine.transaction))
            .where(Fine.id == fine_id)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def create(self, fine: Fine) -> Fine:
        """Persist a new fine."""
        self.db.add(fine)
        self.db.flush()
        return fine
