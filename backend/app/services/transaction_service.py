"""Circulation transaction business logic."""

from datetime import timedelta
from decimal import Decimal
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
    StudentActiveTransactionResponse,
    TransactionIssueRequest,
    TransactionResponse,
    TransactionReturnRequest,
)
from app.services.audit_log_service import AuditLogService
from app.services.fine_service import FineService
from app.services.notification_service import NotificationService


class TransactionService:
    """Service layer for issue and return workflows."""

    def __init__(self, db: Session) -> None:
        self.repository = TransactionRepository(db)
        self.circulation_repository = CirculationRepository(db)
        self.reservation_repository = ReservationRepository(db)
        self.fine_repository = FineRepository(db)
        self.fine_service = FineService(db)
        self.notification_service = NotificationService(db)
        self.audit_log_service = AuditLogService(db)
        self.policy_repository = CirculationPolicyRepository(db)
        self._max_fine_amount: Decimal | None = None
        self._max_renewals: int | None = None
        self.db = db

    @staticmethod
    def _is_overdue(transaction: Transaction) -> bool:
        """Return True when an issued loan is past its due date."""
        return transaction.status == TransactionStatus.ISSUED and transaction.due_at < utc_today()

    def _to_response(self, transaction: Transaction) -> TransactionResponse:
        """Build a transaction API response."""
        fine_amount = transaction.fine.amount if transaction.fine is not None else None
        fine_is_capped = None
        if fine_amount is not None:
            if self._max_fine_amount is None:
                self._max_fine_amount = self.policy_repository.get_active().max_fine_amount
            fine_is_capped = fine_amount >= self._max_fine_amount
        if self._max_renewals is None:
            self._max_renewals = self.policy_repository.get_active().max_renewals
        return TransactionResponse(
            id=transaction.id,
            book_copy_id=transaction.book_copy_id,
            student_id=transaction.student_id,
            issued_by=transaction.issued_by,
            issued_at=transaction.issued_at,
            due_at=transaction.due_at,
            renewal_count=transaction.renewal_count,
            max_renewals=self._max_renewals,
            returned_at=transaction.returned_at,
            status=transaction.status.value,
            is_overdue=self._is_overdue(transaction),
            fine_amount=fine_amount,
            fine_is_capped=fine_is_capped,
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

    def _expire_stale_reservations(self) -> None:
        """Expire old queue entries before circulation decisions use the queue."""
        expired_reservations = self.reservation_repository.expire_stale_returning_reservations()
        if not expired_reservations:
            return
        for reservation in expired_reservations:
            self.audit_log_service.record(
                actor=None,
                action="RESERVATION_EXPIRED",
                entity_type="RESERVATION",
                entity_id=reservation.id,
                summary=f'Reservation for "{reservation.book.title}" expired',
                details={
                    "book_title": reservation.book.title,
                    "student_name": (
                        f"{reservation.student.first_name} {reservation.student.last_name}".strip()
                    ),
                    "student_code": reservation.student.student_code,
                    "expiry_date": reservation.expiry_date.isoformat(),
                },
            )
        for book_id in {reservation.book_id for reservation in expired_reservations}:
            self.circulation_repository.release_reserved_copies_without_queue(book_id)
        commit_or_raise_conflict(self.db, detail="Failed to expire stale reservations")

    def issue_copy(self, payload: TransactionIssueRequest, issued_by: User) -> TransactionResponse:
        """Issue an available copy to a student, honoring the reservation queue."""
        copy_id, student_id = self._resolve_issue_targets(payload)
        self._expire_stale_reservations()

        self.fine_service.sync_open_overdue_fines(student_id)
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
                    f"Student has reached the limit of {policy.max_active_loans} concurrent loans"
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
            student_name = f"{student.first_name} {student.last_name}".strip()
            self.audit_log_service.record(
                actor=issued_by,
                action="RESERVATION_FULFILLED",
                entity_type="RESERVATION",
                entity_id=active_reservation.id,
                summary=f'Reservation for "{copy.book.title}" fulfilled for {student_name}',
                details={
                    "book_title": copy.book.title,
                    "inventory_code": copy.inventory_code,
                    "student_name": student_name,
                    "student_code": student.student_code,
                    "transaction_id": str(transaction.id),
                },
            )

        self.notification_service.create_once(
            user_id=student.id,
            event_key=f"loan-issued:{transaction.id}",
            notification_type="BOOK_ISSUED",
            title="Book issued to you",
            message=(
                f"{copy.book.title} was issued to you and is due on {due_at.strftime('%d %b %Y')}."
            ),
            link="/circulation/my-loans",
        )
        student_name = f"{student.first_name} {student.last_name}".strip()
        self.audit_log_service.record(
            actor=issued_by,
            action="BOOK_ISSUED",
            entity_type="TRANSACTION",
            entity_id=transaction.id,
            summary=(f'Issued "{copy.book.title}" (copy {copy.inventory_code}) to {student_name}'),
            details={
                "book_title": copy.book.title,
                "inventory_code": copy.inventory_code,
                "student_name": student_name,
                "student_code": student.student_code,
                "due_date": due_at.isoformat(),
                "reservation_fulfilled": active_reservation is not None,
            },
        )

        commit_or_raise_conflict(
            self.db,
            detail="Book copy already has an open loan",
        )
        refreshed = self.repository.get_by_id_with_relations(transaction.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def renew_loan(self, transaction_id: UUID, student: User) -> TransactionResponse:
        """Extend an eligible loan by the active policy's loan period."""
        self._expire_stale_reservations()
        self.fine_service.sync_open_overdue_fines(student.id)
        transaction = self.repository.get_for_student_for_update(transaction_id, student.id)
        if transaction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
        if transaction.status != TransactionStatus.ISSUED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only active loans can be renewed",
            )
        if transaction.due_at < utc_today():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Overdue loans cannot be renewed",
            )

        policy = self.policy_repository.get_active()
        if transaction.renewal_count >= policy.max_renewals:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This loan has reached its renewal limit",
            )
        if (
            self.circulation_repository.get_active_book_for_update(transaction.book_copy.book_id)
            is None
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        if self.reservation_repository.list_queue_for_book(transaction.book_copy.book_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This book has an active reservation queue and cannot be renewed",
            )
        if self.fine_repository.has_unpaid_for_student(student.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unpaid fines must be cleared before renewing a book",
            )

        previous_due_date = transaction.due_at
        transaction.due_at += timedelta(days=policy.loan_period_days)
        transaction.renewal_count += 1
        self.notification_service.mark_due_reminders_read(student.id, transaction.id)
        self.audit_log_service.record(
            actor=student,
            action="BOOK_RENEWED",
            entity_type="TRANSACTION",
            entity_id=transaction.id,
            summary=(
                f'Renewed "{transaction.book_copy.book.title}" '
                f"(copy {transaction.book_copy.inventory_code})"
            ),
            details={
                "book_title": transaction.book_copy.book.title,
                "inventory_code": transaction.book_copy.inventory_code,
                "previous_due_date": previous_due_date.isoformat(),
                "new_due_date": transaction.due_at.isoformat(),
                "renewal_count": transaction.renewal_count,
                "student_code": student.student_code,
            },
        )
        commit_or_raise_conflict(self.db, detail="Failed to renew loan")
        refreshed = self.repository.get_by_id_with_relations(transaction_id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def return_copy(
        self,
        payload: TransactionReturnRequest,
        returned_by: User,
    ) -> TransactionResponse:
        """Return a borrowed copy and create an overdue fine when applicable."""
        copy_id = self._resolve_copy_id(payload)
        self._expire_stale_reservations()

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
        copy.status = BookCopyStatus.RESERVED if queue_waiting else BookCopyStatus.AVAILABLE

        self.notification_service.create_once(
            user_id=transaction.student_id,
            event_key=f"loan-returned:{transaction.id}",
            notification_type="BOOK_RETURNED",
            title="Book return recorded",
            message=f"{copy.book.title} has been returned and removed from your active loans.",
            link="/circulation/my-loans",
        )

        if queue_waiting:
            next_reservation = queue_waiting[0]
            self.notification_service.create_once(
                user_id=next_reservation.student_id,
                event_key=f"reservation-ready:{next_reservation.id}:{copy.id}",
                notification_type="RESERVATION_READY",
                title="Your reserved book is ready",
                message=f"A copy of {copy.book.title} is ready for you to collect.",
                link="/circulation/my-reservations",
            )

        fine = None
        if returned_at.date() > transaction.due_at:
            fine = self.fine_service.create_overdue_fine(transaction, returned_at)
        if payload.pay_fine and fine is not None:
            fine.paid = True
            fine.paid_at = returned_at
        if fine is not None:
            fine_was_paid = payload.pay_fine
            fine_status_message = (
                "paid with the return" if fine_was_paid else "recorded after the overdue return"
            )
            self.notification_service.create_once(
                user_id=transaction.student_id,
                event_key=(f"fine-paid:{fine.id}" if fine_was_paid else f"fine-recorded:{fine.id}"),
                notification_type="FINE_PAID" if fine_was_paid else "FINE_RECORDED",
                title="Fine payment recorded" if fine_was_paid else "Overdue fine recorded",
                message=(
                    f"A fine of ₹{fine.amount:.2f} for {copy.book.title} was {fine_status_message}."
                ),
                link="/circulation/my-fines",
            )

        student = transaction.student
        student_name = f"{student.first_name} {student.last_name}".strip()
        self.audit_log_service.record(
            actor=returned_by,
            action="BOOK_RETURNED",
            entity_type="TRANSACTION",
            entity_id=transaction.id,
            summary=(
                f'Returned "{copy.book.title}" (copy {copy.inventory_code}) from {student_name}'
            ),
            details={
                "book_title": copy.book.title,
                "inventory_code": copy.inventory_code,
                "student_name": student_name,
                "student_code": student.student_code,
                "due_date": transaction.due_at.isoformat(),
                "returned_at": returned_at.isoformat(),
            },
        )
        if fine is not None:
            action = "FINE_PAID" if payload.pay_fine else "FINE_RECORDED"
            self.audit_log_service.record(
                actor=returned_by,
                action=action,
                entity_type="FINE",
                entity_id=fine.id,
                summary=(
                    f'Fine of ₹{fine.amount:.2f} for "{copy.book.title}" was '
                    f"{'paid' if payload.pay_fine else 'recorded'} on return"
                ),
                details={
                    "amount": str(fine.amount),
                    "book_title": copy.book.title,
                    "inventory_code": copy.inventory_code,
                    "student_name": student_name,
                    "student_code": student.student_code,
                    "paid": bool(payload.pay_fine),
                },
            )

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
        q: str | None = None,
    ) -> PaginatedResponse[TransactionResponse]:
        """List transactions with role-aware scoping."""
        if not is_staff:
            if student_id is not None and student_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            student_id = current_user.id
        elif status_filter == TransactionStatus.ISSUED:
            self.fine_service.sync_open_overdue_fines(student_id)

        items, total = self.repository.list_transactions(
            page=page,
            page_size=page_size,
            student_id=student_id,
            status=status_filter,
            overdue=overdue,
            book_id=book_id,
            q=q,
        )
        responses = [self._to_response(item) for item in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def list_active_for_student(self, student: User) -> list[StudentActiveTransactionResponse]:
        """Return open loans for the authenticated student."""
        self.fine_service.sync_open_overdue_fines(student.id)
        items = self.repository.list_active_for_student(student.id)
        return [
            StudentActiveTransactionResponse.model_validate(
                self._to_response(item).model_dump(),
            )
            for item in items
        ]
