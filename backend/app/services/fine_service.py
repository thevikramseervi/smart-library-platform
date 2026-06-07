"""Fine business logic."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fine import Fine
from app.models.transaction import Transaction
from app.models.user import User
from app.repositories.fine_repository import FineRepository
from app.schemas.fine import FineResponse
from app.schemas.pagination import PaginatedResponse


class FineService:
    """Service layer for fine management."""

    def __init__(self, db: Session) -> None:
        self.repository = FineRepository(db)
        self.db = db

    def create_overdue_fine(self, transaction: Transaction, returned_at: datetime) -> Fine | None:
        """Create an overdue fine when a book is returned late."""
        if self.repository.get_by_transaction_id(transaction.id) is not None:
            return self.repository.get_by_transaction_id(transaction.id)

        days_late = (returned_at.date() - transaction.due_at).days
        if days_late <= 0:
            return None

        amount = Decimal(days_late) * settings.DAILY_OVERDUE_FINE_RATE
        fine = Fine(
            transaction_id=transaction.id,
            amount=amount,
            reason=f"Overdue return: {days_late} day(s) late",
            paid=False,
        )
        return self.repository.create(fine)

    def list_my_fines(self, student: User) -> list[FineResponse]:
        """Return fines for the authenticated student."""
        fines = self.repository.list_for_student(student.id)
        return [FineResponse.model_validate(fine) for fine in fines]

    def list_fines(
        self,
        *,
        page: int,
        page_size: int,
        paid: bool | None = None,
        student_id: UUID | None = None,
    ) -> PaginatedResponse[FineResponse]:
        """Return paginated fines for staff."""
        items, total = self.repository.list_fines(
            page=page,
            page_size=page_size,
            paid=paid,
            student_id=student_id,
        )
        responses = [FineResponse.model_validate(item) for item in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def mark_paid(self, fine_id: UUID) -> FineResponse:
        """Mark a fine as paid."""
        fine = self.repository.get_by_id(fine_id)
        if fine is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fine not found")
        if fine.paid:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fine already paid")

        fine.paid = True
        fine.paid_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(fine)
        return FineResponse.model_validate(fine)
