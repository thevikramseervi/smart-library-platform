"""Circulation transaction business logic."""

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import utc_now, utc_today
from app.core.db_errors import commit_or_raise_conflict
from app.models.book_copy import BookCopyStatus
from app.models.reservation import ReservationStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.repositories.circulation_policy_repository import CirculationPolicyRepository
from app.repositories.circulation_repository import CirculationRepository
from app.repositories.fine_repository import FineRepository
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.pagination import PaginatedResponse
from app.schemas.transaction import (
    TransactionIssueRequest,
    TransactionResponse,
    TransactionReturnRequest,
)
from app.services.fine_service import FineService


class TransactionService:
    """Service layer for issue and return workflows."""

    def __init__(self, db: Session) -> None:
        self.repository = TransactionRepository(db)
        self.circulation_repository = CirculationRepository(db)
        self.reservation_repository = ReservationRepository(db)
        self.fine_repository = FineRepository(db)
        self.fine_service = FineService(db)
        self.policy_repository = CirculationPolicyRepository(db)
        self.db = db

    @staticmethod
    def _is_overdue(transaction: Transaction) -> bool:
        """Return True when an issued loan is past its due date."""
        return (
            transaction.status == TransactionStatus.ISSUED
            and transaction.due_at < utc_today()
        )

    def _to_response(self, transaction: Transaction) -> TransactionResponse:
        """Build a transaction API response."""
        return TransactionResponse(
            id=transaction.id,
            book_copy_id=transaction.book_copy_id,
            student_id=transaction.student_id,
            issued_by=transaction.issued_by,
            issued_at=transaction.issued_at,
            due_at=transaction.due_at,
            returned_at=transaction.returned_at,
            status=transaction.status.value,
            is_overdue=self._is_overdue(transaction),
            book_copy=transaction.book_copy,
            student=transaction.student,
            issuer=transaction.issuer,
        )

    def _resolve_issue_targets(
        self,
        payload: TransactionIssueRequest,
    ) -> tuple[UUID, UUID]:
        """Resolve copy and student ids from UUID or code identifiers."""
        if payload.book_copy_id is not None and payload.student_id is not None:
            return payload.book_copy_id, payload.student_id

        assert payload.inventory_code is not None and payload.student_code is not None
        copy = self.circulation_repository.get_copy_by_inventory_code(payload.inventory_code)
        if copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")
        student = self.circulation_repository.get_student_by_code(payload.student_code)
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return copy.id, student.id

    def _resolve_copy_id(self, payload: TransactionReturnRequest) -> UUID:
        """Resolve copy id from UUID or inventory code."""
        if payload.book_copy_id is not None:
            return payload.book_copy_id
        assert payload.inventory_code is not None
        copy = self.circulation_repository.get_copy_by_inventory_code(payload.inventory_code)
        if copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")
        return copy.id

    def issue_copy(self, payload: TransactionIssueRequest, issued_by: User) -> TransactionResponse:
        """Issue an available copy to a student, honoring the reservation queue."""
        copy_id, student_id = self._resolve_issue_targets(payload)

        if self.fine_repository.has_unpaid_for_student(student_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student has unpaid fines and cannot borrow books",
            )

        student = self.circulation_repository.get_student_for_update(student_id)
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

        copy = self.circulation_repository.get_copy_for_update(copy_id)
        if copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")

        queue = self.reservation_repository.list_queue_for_book(copy.book_id)
        head_student_id = queue[0].student_id if queue else None
        is_head = head_student_id == student_id

        if copy.status not in (BookCopyStatus.AVAILABLE, BookCopyStatus.RESERVED):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book copy is not available for issue",
            )
        if copy.status == BookCopyStatus.RESERVED and not is_head:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This copy is held for the first student in the reservation queue",
            )
        if (
            copy.status == BookCopyStatus.AVAILABLE
            and queue
            and not is_head
            and not payload.bypass_reservation
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Students are waiting in the reservation queue for this book; "
                    "retry with bypass_reservation to override"
                ),
            )

        active_reservation = self.reservation_repository.get_active_for_student_book_for_update(
            student_id,
            copy.book_id,
        )
        if active_reservation is not None:
            if active_reservation.status != ReservationStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Reservation is no longer active",
                )

        if self.repository.has_open_loan_for_book(student_id, copy.book_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student already has an open loan for this book",
            )
        policy = self.policy_repository.get_active()
        if self.repository.count_active_for_student(student_id) >= policy.max_active_loans:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Student has reached the limit of "
                    f"{policy.max_active_loans} concurrent loans"
                ),
            )
        if self.repository.get_open_for_copy(copy_id) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book copy already has an open loan",
            )

        issued_at = utc_now()
        due_at = issued_at.date() + timedelta(days=policy.loan_period_days)
        transaction = Transaction(
            book_copy_id=copy_id,
            student_id=student_id,
            issued_by=issued_by.id,
            issued_at=issued_at,
            due_at=due_at,
            status=TransactionStatus.ISSUED,
            reservation_id=active_reservation.id if active_reservation else None,
        )
        copy.status = BookCopyStatus.BORROWED
        self.repository.create(transaction)

        if active_reservation is not None:
            active_reservation.status = ReservationStatus.FULFILLED

        commit_or_raise_conflict(
            self.db,
            detail="Book copy already has an open loan",
        )
        refreshed = self.repository.get_by_id_with_relations(transaction.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def return_copy(
        self,
        payload: TransactionReturnRequest,
        returned_by: User,
    ) -> TransactionResponse:
        """Return a borrowed copy and create an overdue fine when applicable."""
        copy_id = self._resolve_copy_id(payload)

        copy = self.circulation_repository.get_copy_for_update(copy_id)
        if copy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book copy not found")

        transaction = self.repository.get_open_for_copy_for_update(copy_id)
        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No open loan found for this copy",
            )

        returned_at = utc_now()
        transaction.returned_at = returned_at
        transaction.status = TransactionStatus.RETURNED
        transaction.returned_by = returned_by.id
        queue_waiting = self.reservation_repository.list_queue_for_book(copy.book_id)
        copy.status = (
            BookCopyStatus.RESERVED if queue_waiting else BookCopyStatus.AVAILABLE
        )

        if returned_at.date() > transaction.due_at:
            self.fine_service.create_overdue_fine(transaction, returned_at)

        self.db.commit()
        refreshed = self.repository.get_by_id_with_relations(transaction.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def get_transaction(
        self,
        transaction_id: UUID,
        *,
        current_user: User,
        is_staff: bool,
    ) -> TransactionResponse:
        """Return a transaction if the caller is allowed to view it."""
        transaction = self.repository.get_by_id_with_relations(transaction_id)
        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        if not is_staff and transaction.student_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return self._to_response(transaction)

    def list_transactions(
        self,
        *,
        page: int,
        page_size: int,
        current_user: User,
        is_staff: bool,
        student_id: UUID | None = None,
        status_filter: TransactionStatus | None = None,
        overdue: bool | None = None,
        book_id: UUID | None = None,
    ) -> PaginatedResponse[TransactionResponse]:
        """List transactions with role-aware scoping."""
        if not is_staff:
            if student_id is not None and student_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            student_id = current_user.id

        items, total = self.repository.list_transactions(
            page=page,
            page_size=page_size,
            student_id=student_id,
            status=status_filter,
            overdue=overdue,
            book_id=book_id,
        )
        responses = [self._to_response(item) for item in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def list_active_for_student(self, student: User) -> list[TransactionResponse]:
        """Return open loans for the authenticated student."""
        items = self.repository.list_active_for_student(student.id)
        return [self._to_response(item) for item in items]
