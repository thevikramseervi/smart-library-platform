"""Book repository."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.author import Author
from app.models.book import Book
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.publisher import Publisher
from app.repositories.base import BaseRepository


class BookRepository(BaseRepository[Book]):
    """Database access for books."""

    def __init__(self, db: Session) -> None:
        super().__init__(Book, db)

    def _with_relations(self):
        """Base select with eager-loaded relations."""
        return select(Book).options(
            selectinload(Book.publisher),
            selectinload(Book.language),
            selectinload(Book.authors),
            selectinload(Book.categories),
            selectinload(Book.copies),
        )

    def get_active_by_id(self, book_id: UUID) -> Book | None:
        """Fetch a non-deleted book with relations."""
        statement = self._with_relations().where(
            Book.id == book_id,
            Book.deleted_at.is_(None),
        )
        return self.db.execute(statement).unique().scalar_one_or_none()

    def get_by_isbn(self, isbn: str, *, exclude_id: UUID | None = None) -> Book | None:
        """Fetch a non-deleted book by ISBN."""
        statement = select(Book).where(
            Book.isbn == isbn,
            Book.deleted_at.is_(None),
        )
        if exclude_id is not None:
            statement = statement.where(Book.id != exclude_id)
        return self.db.execute(statement).scalar_one_or_none()

    def list_books(
        self,
        *,
        page: int,
        page_size: int,
        q: str | None = None,
        category_id: UUID | None = None,
        author_id: UUID | None = None,
        sort: str | None = None,
    ) -> tuple[list[Book], int]:
        """Return paginated non-deleted books with optional filters."""
        id_query = select(Book.id).where(Book.deleted_at.is_(None))

        if category_id is not None:
            id_query = id_query.where(Book.categories.any(id=category_id))

        if author_id is not None:
            id_query = id_query.where(Book.authors.any(id=author_id))

        if q:
            pattern = f"%{q}%"
            id_query = (
                id_query.outerjoin(Book.authors)
                .outerjoin(Book.publisher)
                .where(
                    or_(
                        Book.title.ilike(pattern),
                        Book.isbn.ilike(pattern),
                        Author.name.ilike(pattern),
                        Publisher.name.ilike(pattern),
                    )
                )
            )

        id_query = id_query.distinct()
        total = self.db.execute(select(func.count()).select_from(id_query.subquery())).scalar_one()

        sort_field = sort.lstrip("-") if sort else "title"
        descending = sort.startswith("-") if sort else False
        order_column = {
            "title": Book.title,
            "publication_year": Book.publication_year,
            "created_at": Book.created_at,
        }.get(sort_field, Book.title)
        order = order_column.desc() if descending else order_column.asc()

        book_ids_subq = id_query.subquery()
        statement = (
            self._with_relations()
            .join(book_ids_subq, Book.id == book_ids_subq.c.id)
            .order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(statement).unique().scalars().all())
        return items, total

    def create(self, book: Book) -> Book:
        """Persist a new book."""
        self.db.add(book)
        self.db.flush()
        return book

    def sync_authors(self, book: Book, authors: list[Author]) -> None:
        """Replace book author associations."""
        book.authors = authors
        self.db.flush()

    def sync_categories(self, book: Book, categories: list) -> None:
        """Replace book category associations."""
        book.categories = categories
        self.db.flush()

    def get_copy_counts(self, book_id: UUID) -> tuple[int, int]:
        """Return total and available copy counts for a book."""
        total_stmt = (
            select(func.count())
            .select_from(BookCopy)
            .where(BookCopy.book_id == book_id)
        )
        available_stmt = (
            select(func.count())
            .select_from(BookCopy)
            .where(
                BookCopy.book_id == book_id,
                BookCopy.status == BookCopyStatus.AVAILABLE,
            )
        )
        total = self.db.execute(total_stmt).scalar_one()
        available = self.db.execute(available_stmt).scalar_one()
        return total, available
