"""Fine business logic."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import utc_today
from app.models.circulation_policy import CirculationPolicy
from app.models.fine import Fine
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.repositories.circulation_policy_repository import CirculationPolicyRepository
from app.repositories.fine_repository import FineRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.fine import FineResponse
from app.schemas.pagination import PaginatedResponse
from app.services.audit_log_service import AuditLogService
from app.services.notification_service import NotificationService


class FineService:
    """Service layer for fine management."""

    def __init__(self, db: Session) -> None:
        self.repository = FineRepository(db)
        self.policy_repository = CirculationPolicyRepository(db)
        self.transaction_repository = TransactionRepository(db)
        self.notification_service = NotificationService(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db
        self._active_policy: CirculationPolicy | None = None

    def get_active_policy(self) -> CirculationPolicy:
        if self._active_policy is None:
            self._active_policy = self.policy_repository.get_active()
        return self._active_policy

    def sync_open_overdue_fines(self, student_id: UUID | None = None) -> None:
        """Refresh accrued balances for currently overdue, unreturned books."""
        transactions = self.transaction_repository.list_open_overdue(student_id)
        if not transactions:
            return
        policy = self.get_active_policy()
        today = utc_today()
        accrued: list[tuple[UUID, Decimal, int]] = []
        for transaction_id, due_at in transactions:
            days_late = (today - due_at).days
            amount = min(
                Decimal(days_late) * policy.daily_overdue_fine_rate,
                policy.max_fine_amount,
            )
            if amount <= 0:
                continue
            accrued.append((transaction_id, amount, days_late))
        self.repository.save_accrued_many(accrued)
        if not accrued:
            return
        self.db.commit()

    def create_overdue_fine(self, transaction: Transaction, returned_at: datetime) -> Fine | None:
        """Create an overdue fine when a book is returned late."""
        days_late = (returned_at.date() - transaction.due_at).days
        if days_late <= 0:
            return None

        policy = self.get_active_policy()
        amount = min(
            Decimal(days_late) * policy.daily_overdue_fine_rate,
            policy.max_fine_amount,
        )
        if amount <= 0:
            return None
        existing = self.repository.get_by_transaction_id(transaction.id)
        if existing is None:
            return self.repository.create(
                Fine(
                    transaction_id=transaction.id,
                    amount=amount,
                    reason=f"Overdue return: {days_late} day(s) late",
                    paid=False,
                )
            )
        existing.amount = amount
        existing.reason = f"Overdue return: {days_late} day(s) late"
        existing.paid = False
        existing.paid_at = None
        return existing

    def _response(self, fine: Fine) -> FineResponse:
        policy = self.get_active_policy()
        return FineResponse(
            id=fine.id,
            transaction_id=fine.transaction_id,
            student_name=(
                f"{fine.transaction.student.first_name} {fine.transaction.student.last_name}"
            ),
            student_code=fine.transaction.student.student_code,
            book_title=fine.transaction.book_copy.book.title,
            inventory_code=fine.transaction.book_copy.inventory_code,
            due_at=fine.transaction.due_at,
            amount=fine.amount,
            reason=fine.reason,
            paid=fine.paid,
            paid_at=fine.paid_at,
            created_at=fine.created_at,
            is_accruing=fine.transaction.status == TransactionStatus.ISSUED,
            is_capped=(
                fine.transaction.status == TransactionStatus.ISSUED
                and fine.amount >= policy.max_fine_amount
            ),
        )

    def list_my_fines(self, student: User) -> list[FineResponse]:
        """Return fines for the authenticated student."""
        self.sync_open_overdue_fines(student.id)
        fines = self.repository.list_for_student(student.id)
        return [self._response(fine) for fine in fines]

    def list_fines(
        self,
        *,
        page: int,
        page_size: int,
        paid: bool | None = None,
        student_id: UUID | None = None,
        q: str | None = None,
    ) -> PaginatedResponse[FineResponse]:
        """Return paginated fines for staff."""
        self.sync_open_overdue_fines(student_id)
        items, total = self.repository.list_fines(
            page=page,
            page_size=page_size,
            paid=paid,
            student_id=student_id,
            q=q,
        )
        responses = [self._response(item) for item in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def mark_paid(self, fine_id: UUID, paid_by: User) -> FineResponse:
        """Mark a fine as paid exactly once, even under concurrent requests."""
        fine = self.repository.get_by_id(fine_id)
        if fine is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fine not found")
        if fine.transaction.status == TransactionStatus.ISSUED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The overdue book must be returned before its fine can be paid",
            )
        updated_rows = self.repository.mark_paid_if_unpaid(fine_id)
        if updated_rows is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fine not found")
        if updated_rows == 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fine already paid")
        self.notification_service.create_once(
            user_id=fine.transaction.student_id,
            event_key=f"fine-paid:{fine.id}",
            notification_type="FINE_PAID",
            title="Fine payment recorded",
            message=(
                f"Payment of ₹{fine.amount:.2f} for "
                f"{fine.transaction.book_copy.book.title} has been recorded."
            ),
            link="/circulation/my-fines",
        )
        student = fine.transaction.student
        self.audit_log_service.record(
            actor=paid_by,
            action="FINE_PAID",
            entity_type="FINE",
            entity_id=fine.id,
            summary=(
                f"Fine of ₹{fine.amount:.2f} for \"{fine.transaction.book_copy.book.title}\" "
                f"was marked paid for {student.first_name} {student.last_name}"
            ),
            details={
                "amount": str(fine.amount),
                "book_title": fine.transaction.book_copy.book.title,
                "inventory_code": fine.transaction.book_copy.inventory_code,
                "student_name": f"{student.first_name} {student.last_name}".strip(),
                "student_code": student.student_code,
            },
        )
        self.db.commit()
        return self._response(self.repository.get_by_id(fine_id))
