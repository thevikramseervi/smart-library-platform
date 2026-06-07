"""Reservation business logic."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db_errors import commit_or_raise_conflict
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.repositories.circulation_repository import CirculationRepository
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.pagination import PaginatedResponse
from app.schemas.reservation import ReservationCreate, ReservationResponse, ReservationStudentSummary


class ReservationService:
    """Service layer for book reservations."""

    def __init__(self, db: Session) -> None:
        self.repository = ReservationRepository(db)
        self.circulation_repository = CirculationRepository(db)
        self.transaction_repository = TransactionRepository(db)
        self.db = db

    def _to_response(self, reservation: Reservation) -> ReservationResponse:
        """Build a reservation API response with queue position."""
        return ReservationResponse(
            id=reservation.id,
            student_id=reservation.student_id,
            book_id=reservation.book_id,
            reservation_date=reservation.reservation_date,
            expiry_date=reservation.expiry_date,
            status=reservation.status.value,
            queue_position=self.repository.compute_queue_position(reservation),
            book=reservation.book,
            student=ReservationStudentSummary.model_validate(reservation.student),
        )

    def _expire_stale(self) -> None:
        """Expire reservations past their expiry date and persist changes."""
        if self.repository.expire_stale():
            commit_or_raise_conflict(self.db, detail="Failed to expire stale reservations")

    def create_reservation(self, student: User, payload: ReservationCreate) -> ReservationResponse:
        """Create a reservation when no copies are available."""
        self._expire_stale()

        book = self.circulation_repository.get_active_book(payload.book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

        if self.circulation_repository.count_available_copies(payload.book_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book has available copies; reservation not allowed",
            )
        if self.transaction_repository.has_open_loan_for_book(student.id, payload.book_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student already has an open loan for this book",
            )
        if self.repository.get_active_for_student_book(student.id, payload.book_id) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student already has an active reservation for this book",
            )

        now = datetime.now(UTC)
        reservation = Reservation(
            student_id=student.id,
            book_id=payload.book_id,
            reservation_date=now,
            expiry_date=now + timedelta(days=settings.RESERVATION_EXPIRY_DAYS),
            status=ReservationStatus.ACTIVE,
        )
        created = self.repository.create(reservation)
        commit_or_raise_conflict(
            self.db,
            detail="Student already has an active reservation for this book",
        )
        refreshed = self.repository.get_by_id_with_relations(created.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def cancel_reservation(
        self,
        reservation_id: UUID,
        actor: User,
        *,
        is_staff: bool,
    ) -> None:
        """Cancel an active reservation."""
        reservation = self.repository.get_by_id_with_relations(reservation_id)
        if reservation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
        if reservation.status != ReservationStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only active reservations can be cancelled",
            )
        if not is_staff and reservation.student_id != actor.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        reservation.status = ReservationStatus.CANCELLED
        self.db.commit()

    def list_my_reservations(self, student: User) -> list[ReservationResponse]:
        """Return reservations for the authenticated student."""
        self._expire_stale()
        items = self.repository.list_for_student(student.id)
        return [self._to_response(item) for item in items]

    def list_reservations(
        self,
        *,
        page: int,
        page_size: int,
        book_id: UUID | None = None,
        status_filter: ReservationStatus | None = None,
    ) -> PaginatedResponse[ReservationResponse]:
        """Return paginated reservations for staff."""
        self._expire_stale()
        items, total = self.repository.list_reservations(
            page=page,
            page_size=page_size,
            book_id=book_id,
            status=status_filter,
        )
        responses = [self._to_response(item) for item in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def get_queue(self, book_id: UUID) -> list[ReservationResponse]:
        """Return FIFO reservation queue for a book."""
        self._expire_stale()
        book = self.circulation_repository.get_active_book(book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        items = self.repository.list_queue_for_book(book_id)
        return [self._to_response(item) for item in items]
