"""Cross-connection concurrency tests for reservation state transitions.

Unlike the rest of the suite these tests commit real data to the test
database (and clean it up afterwards) because lost-update races can only be
reproduced with two independent database connections.
"""

from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.seed import DEV_STUDENT_EMAIL, seed_departments, seed_dev_student, seed_roles
from app.models.book import Book
from app.models.book_copy import BookCopy
from app.models.language import Language
from app.models.publisher import Publisher
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.repositories.reservation_repository import ReservationRepository
from tests.db import TEST_DATABASE_URL


@pytest.fixture(scope="module")
def committed_reservation() -> Generator[dict, None, None]:
    """Seed one active reservation with committed data shared by raw connections."""
    engine = create_engine(TEST_DATABASE_URL)
    with Session(engine) as session:
        roles = seed_roles(session)
        departments = seed_departments(session)
        seed_dev_student(session, roles["STUDENT"])
        student = session.execute(
            select(User).where(User.email == DEV_STUDENT_EMAIL)
        ).scalar_one()

        language = Language(name="Concurrency English", code="cnc")
        publisher = Publisher(name="Concurrency Press")
        book = Book(
            title="Concurrency Test Book",
            isbn="978-CONCURRENCY-1",
            publication_year=2026,
            language=language,
            publisher=publisher,
        )
        copy = BookCopy(book=book, inventory_code="CONC-0001", qr_code_value="QR-CONC-0001")
        session.add_all([language, publisher, book, copy])
        session.flush()

        now = datetime.now(UTC)
        reservation = Reservation(
            student_id=student.id,
            book_id=book.id,
            reservation_date=now,
            expiry_date=now + timedelta(days=settings.RESERVATION_EXPIRY_DAYS),
            status=ReservationStatus.ACTIVE,
        )
        session.add(reservation)
        session.commit()

        ids = {
            "student_id": student.id,
            "book_id": book.id,
            "reservation_id": reservation.id,
            "language_id": language.id,
            "publisher_id": publisher.id,
            "department_ids": [d.id for d in departments],
        }
        yield ids

        # Cleanup in reverse dependency order.
        session.execute(delete(Reservation).where(Reservation.book_id == ids["book_id"]))
        session.execute(delete(BookCopy).where(BookCopy.book_id == ids["book_id"]))
        session.execute(delete(Book).where(Book.id == ids["book_id"]))
        session.execute(delete(Publisher).where(Publisher.id == ids["publisher_id"]))
        session.execute(delete(Language).where(Language.id == ids["language_id"]))
        session.execute(delete(User).where(User.id == ids["student_id"]))
        session.commit()


def _fresh_session() -> Session:
    return Session(create_engine(TEST_DATABASE_URL))


def test_cancel_after_fulfill_does_not_overwrite(committed_reservation: dict) -> None:
    """A cancel that locks the row after a concurrent fulfillment must 409, not clobber."""
    reservation_id = committed_reservation["reservation_id"]

    fulfiller = _fresh_session()
    try:
        repo = ReservationRepository(fulfiller)
        locked = repo.get_active_for_student_book_for_update(
            committed_reservation["student_id"],
            committed_reservation["book_id"],
        )
        assert locked is not None
        locked.status = ReservationStatus.FULFILLED
        fulfiller.commit()
    finally:
        fulfiller.close()

    canceller = _fresh_session()
    try:
        repo = ReservationRepository(canceller)
        locked = repo.get_by_id_with_relations_for_update(reservation_id)
        assert locked is not None
        assert locked.status == ReservationStatus.FULFILLED, (
            "cancel path observed stale ACTIVE status; locking is not effective"
        )
        locked.status = ReservationStatus.CANCELLED
        canceller.rollback()
    finally:
        canceller.close()

    verifier = _fresh_session()
    try:
        final = verifier.get(Reservation, reservation_id)
        assert final is not None
        assert final.status == ReservationStatus.FULFILLED
    finally:
        verifier.close()


def test_duplicate_active_reservation_violates_constraint(committed_reservation: dict) -> None:
    """The partial unique index rejects a second ACTIVE reservation for the same pair."""
    setup = _fresh_session()
    try:
        existing = setup.get(Reservation, committed_reservation["reservation_id"])
        assert existing is not None
        existing.status = ReservationStatus.ACTIVE
        setup.commit()
    finally:
        setup.close()

    session = _fresh_session()
    try:
        now = datetime.now(UTC)
        duplicate = Reservation(
            student_id=committed_reservation["student_id"],
            book_id=committed_reservation["book_id"],
            reservation_date=now,
            expiry_date=now + timedelta(days=settings.RESERVATION_EXPIRY_DAYS),
            status=ReservationStatus.ACTIVE,
        )
        session.add(duplicate)
        with pytest.raises(IntegrityError):
            session.commit()
    finally:
        session.rollback()
        session.close()
