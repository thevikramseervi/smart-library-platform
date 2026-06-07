"""Reservation repository."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.reservation import Reservation, ReservationStatus
from app.repositories.base import BaseRepository


class ReservationRepository(BaseRepository[Reservation]):
    """Database access for book reservations."""

    def __init__(self, db: Session) -> None:
        super().__init__(Reservation, db)

    def _with_relations(self):
        """Base select with eager-loaded book and student."""
        return select(Reservation).options(
            selectinload(Reservation.book),
            selectinload(Reservation.student),
        )

    def get_by_id_with_relations(self, reservation_id: UUID) -> Reservation | None:
        """Fetch a reservation with its book."""
        statement = self._with_relations().where(Reservation.id == reservation_id)
        return self.db.execute(statement).unique().scalar_one_or_none()

    def get_active_for_student_book(
        self,
        student_id: UUID,
        book_id: UUID,
    ) -> Reservation | None:
        """Return an active reservation for a student and book."""
        statement = select(Reservation).where(
            Reservation.student_id == student_id,
            Reservation.book_id == book_id,
            Reservation.status == ReservationStatus.ACTIVE,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def expire_stale(self) -> bool:
        """Mark active reservations past expiry as expired."""
        now = datetime.now(UTC)
        statement = select(Reservation).where(
            Reservation.status == ReservationStatus.ACTIVE,
            Reservation.expiry_date < now,
        )
        stale = list(self.db.execute(statement).scalars().all())
        for reservation in stale:
            reservation.status = ReservationStatus.EXPIRED
        if stale:
            self.db.flush()
            return True
        return False

    def list_for_student(self, student_id: UUID) -> list[Reservation]:
        """Return reservations for a student."""
        statement = (
            self._with_relations()
            .where(Reservation.student_id == student_id)
            .order_by(Reservation.reservation_date.desc())
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def list_queue_for_book(self, book_id: UUID) -> list[Reservation]:
        """Return active reservations for a book in FIFO order."""
        statement = (
            self._with_relations()
            .where(
                Reservation.book_id == book_id,
                Reservation.status == ReservationStatus.ACTIVE,
            )
            .order_by(Reservation.reservation_date.asc())
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def list_reservations(
        self,
        *,
        page: int,
        page_size: int,
        book_id: UUID | None = None,
        status: ReservationStatus | None = None,
    ) -> tuple[list[Reservation], int]:
        """Return paginated reservations."""
        statement = self._with_relations()
        if book_id is not None:
            statement = statement.where(Reservation.book_id == book_id)
        if status is not None:
            statement = statement.where(Reservation.status == status)

        total = self.db.execute(
            select(func.count()).select_from(statement.subquery())
        ).scalar_one()
        statement = (
            statement.order_by(Reservation.reservation_date.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).unique().scalars().all())
        return items, total

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
        earlier = self.db.execute(statement).scalar_one()
        return earlier + 1

    def create(self, reservation: Reservation) -> Reservation:
        """Persist a new reservation."""
        self.db.add(reservation)
        self.db.flush()
        return reservation
