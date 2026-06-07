"""Cross-entity circulation queries."""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.role import Role
from app.models.user import User


class CirculationRepository:
    """Shared database queries for circulation workflows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_copy_for_update(self, copy_id: UUID) -> BookCopy | None:
        """Lock a book copy row for update."""
        statement = (
            select(BookCopy)
            .options(selectinload(BookCopy.book))
            .where(BookCopy.id == copy_id)
            .with_for_update()
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_copy_by_inventory_code(self, inventory_code: str) -> BookCopy | None:
        """Fetch a book copy by inventory code."""
        statement = (
            select(BookCopy)
            .options(selectinload(BookCopy.book))
            .where(BookCopy.inventory_code == inventory_code)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_student_by_id(self, student_id: UUID) -> User | None:
        """Fetch an active student user."""
        statement = (
            select(User)
            .options(selectinload(User.role))
            .join(Role, User.role_id == Role.id)
            .where(
                User.id == student_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                Role.name == "STUDENT",
            )
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_student_by_code(self, student_code: str) -> User | None:
        """Fetch an active student by student code."""
        statement = (
            select(User)
            .options(selectinload(User.role))
            .join(Role, User.role_id == Role.id)
            .where(
                User.student_code == student_code,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                Role.name == "STUDENT",
            )
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_students(self, *, limit: int = 500) -> list[User]:
        """Return active students for issue workflows."""
        statement = (
            select(User)
            .options(selectinload(User.role))
            .join(Role, User.role_id == Role.id)
            .where(
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                Role.name == "STUDENT",
            )
            .order_by(User.last_name, User.first_name)
            .limit(limit)
        )
        return list(self.db.execute(statement).scalars().all())

    def search_students(self, query: str, *, limit: int = 20) -> list[User]:
        """Search active students by code, email, or name."""
        pattern = f"%{query.strip()}%"
        statement = (
            select(User)
            .options(selectinload(User.role))
            .join(Role, User.role_id == Role.id)
            .where(
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                Role.name == "STUDENT",
                or_(
                    User.student_code.ilike(pattern),
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                ),
            )
            .order_by(User.last_name, User.first_name)
            .limit(limit)
        )
        return list(self.db.execute(statement).scalars().all())

    def list_available_copies(
        self,
        *,
        book_id: UUID | None = None,
        query: str | None = None,
        limit: int = 50,
    ) -> list[BookCopy]:
        """Return available copies optionally filtered by book or inventory code."""
        if query:
            pattern = f"%{query.strip()}%"
            statement = (
                select(BookCopy)
                .join(Book, BookCopy.book_id == Book.id)
                .options(selectinload(BookCopy.book))
                .where(
                    BookCopy.status == BookCopyStatus.AVAILABLE,
                    or_(
                        BookCopy.inventory_code.ilike(pattern),
                        Book.title.ilike(pattern),
                    ),
                )
            )
        else:
            statement = (
                select(BookCopy)
                .options(selectinload(BookCopy.book))
                .where(BookCopy.status == BookCopyStatus.AVAILABLE)
            )
        if book_id is not None:
            statement = statement.where(BookCopy.book_id == book_id)
        statement = statement.order_by(BookCopy.inventory_code).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def get_active_book(self, book_id: UUID) -> Book | None:
        """Fetch a non-deleted book."""
        statement = select(Book).where(Book.id == book_id, Book.deleted_at.is_(None))
        return self.db.execute(statement).scalar_one_or_none()

    def count_available_copies(self, book_id: UUID) -> int:
        """Return count of available copies for a book."""
        from sqlalchemy import func

        statement = (
            select(func.count())
            .select_from(BookCopy)
            .where(
                BookCopy.book_id == book_id,
                BookCopy.status == BookCopyStatus.AVAILABLE,
            )
        )
        return self.db.execute(statement).scalar_one()
