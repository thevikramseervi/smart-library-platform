"""Book business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.book import Book
from app.repositories.author_repository import AuthorRepository
from app.repositories.book_repository import BookRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.language_repository import LanguageRepository
from app.repositories.publisher_repository import PublisherRepository
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.schemas.pagination import PaginatedResponse


class BookService:
    """Service layer for book management."""

    def __init__(self, db: Session) -> None:
        self.repository = BookRepository(db)
        self.publisher_repository = PublisherRepository(db)
        self.language_repository = LanguageRepository(db)
        self.author_repository = AuthorRepository(db)
        self.category_repository = CategoryRepository(db)
        self.db = db

    def _to_response(self, book: Book) -> BookResponse:
        """Build a book response with copy aggregates."""
        total_copies, available_copies = self.repository.get_copy_counts(book.id)
        return BookResponse(
            id=book.id,
            title=book.title,
            isbn=book.isbn,
            publisher_id=book.publisher_id,
            language_id=book.language_id,
            edition=book.edition,
            publication_year=book.publication_year,
            description=book.description,
            cover_image_url=book.cover_image_url,
            is_digital=book.is_digital,
            publisher=book.publisher,
            language=book.language,
            authors=book.authors,
            categories=book.categories,
            copy_count=total_copies,
            total_copies=total_copies,
            available_copies=available_copies,
        )

    def _validate_foreign_keys(
        self,
        *,
        publisher_id: UUID,
        language_id: UUID,
        author_ids: list[UUID],
        category_ids: list[UUID],
    ) -> tuple[list, list]:
        """Ensure referenced catalog entities exist and are active."""
        publisher = self.publisher_repository.get_active_by_id(publisher_id)
        if publisher is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Publisher not found",
            )

        language = self.language_repository.get_by_id(language_id)
        if language is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Language not found",
            )

        authors = self.author_repository.get_active_by_ids(author_ids)
        if len(authors) != len(set(author_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more authors not found",
            )

        categories = self.category_repository.get_active_by_ids(category_ids)
        if len(categories) != len(set(category_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more categories not found",
            )

        return authors, categories

    def _validate_isbn(self, isbn: str | None, *, exclude_id: UUID | None = None) -> None:
        """Ensure ISBN is unique when provided."""
        if isbn is None:
            return
        existing = self.repository.get_by_isbn(isbn, exclude_id=exclude_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ISBN already exists",
            )

    def list_books(
        self,
        *,
        page: int,
        page_size: int,
        q: str | None = None,
        category_id: UUID | None = None,
        author_id: UUID | None = None,
        sort: str | None = None,
    ) -> PaginatedResponse[BookResponse]:
        """Return paginated books with optional filters."""
        books, total = self.repository.list_books(
            page=page,
            page_size=page_size,
            q=q,
            category_id=category_id,
            author_id=author_id,
            sort=sort,
        )
        items = [self._to_response(book) for book in books]
        return PaginatedResponse.create(items, total, page, page_size)

    def get_book(self, book_id: UUID) -> BookResponse:
        """Return a book by id."""
        book = self.repository.get_active_by_id(book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        return self._to_response(book)

    def create_book(self, payload: BookCreate) -> BookResponse:
        """Create a book with author and category links."""
        self._validate_isbn(payload.isbn)
        authors, categories = self._validate_foreign_keys(
            publisher_id=payload.publisher_id,
            language_id=payload.language_id,
            author_ids=payload.author_ids,
            category_ids=payload.category_ids,
        )

        book = Book(
            title=payload.title,
            isbn=payload.isbn,
            publisher_id=payload.publisher_id,
            language_id=payload.language_id,
            edition=payload.edition,
            publication_year=payload.publication_year,
            description=payload.description,
            cover_image_url=payload.cover_image_url,
            is_digital=payload.is_digital,
        )
        created = self.repository.create(book)
        self.repository.sync_authors(created, authors)
        self.repository.sync_categories(created, categories)
        self.db.commit()

        refreshed = self.repository.get_active_by_id(created.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def update_book(self, book_id: UUID, payload: BookUpdate) -> BookResponse:
        """Update an active book."""
        book = self.repository.get_active_by_id(book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

        if payload.isbn is not None:
            self._validate_isbn(payload.isbn, exclude_id=book_id)
            book.isbn = payload.isbn

        publisher_id = payload.publisher_id or book.publisher_id
        language_id = payload.language_id or book.language_id
        author_ids = (
            payload.author_ids
            if payload.author_ids is not None
            else [author.id for author in book.authors]
        )
        category_ids = (
            payload.category_ids
            if payload.category_ids is not None
            else [category.id for category in book.categories]
        )

        relation_fields = (
            payload.publisher_id,
            payload.language_id,
            payload.author_ids,
            payload.category_ids,
        )
        if any(field is not None for field in relation_fields):
            authors, categories = self._validate_foreign_keys(
                publisher_id=publisher_id,
                language_id=language_id,
                author_ids=author_ids,
                category_ids=category_ids,
            )
            book.publisher_id = publisher_id
            book.language_id = language_id
            self.repository.sync_authors(book, authors)
            self.repository.sync_categories(book, categories)

        if payload.title is not None:
            book.title = payload.title
        if payload.edition is not None:
            book.edition = payload.edition
        if payload.publication_year is not None:
            book.publication_year = payload.publication_year
        if payload.description is not None:
            book.description = payload.description
        if payload.cover_image_url is not None:
            book.cover_image_url = payload.cover_image_url
        if payload.is_digital is not None:
            book.is_digital = payload.is_digital

        self.db.commit()
        refreshed = self.repository.get_active_by_id(book_id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def delete_book(self, book_id: UUID) -> None:
        """Soft delete a book."""
        book = self.repository.get_active_by_id(book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        self.repository.soft_delete(book)
        self.db.commit()
