"""Embedding and vector-search data access."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.book_embedding import BookEmbedding, EmbeddingStatus


class EmbeddingRepository:
    """Database access for book embeddings."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _book_with_relations(self):
        return (
            select(Book)
            .options(
                selectinload(Book.publisher),
                selectinload(Book.language),
                selectinload(Book.authors),
                selectinload(Book.categories),
                selectinload(Book.embedding),
            )
            .where(Book.deleted_at.is_(None))
        )

    def get_book_with_relations(
        self,
        book_id: UUID,
        *,
        for_update: bool = False,
    ) -> Book | None:
        """Fetch one active book with all relations needed for canonical text."""
        statement = self._book_with_relations().where(
            Book.id == book_id,
            Book.deleted_at.is_(None),
        )
        if for_update:
            statement = statement.with_for_update(of=Book).execution_options(
                populate_existing=True,
            )
        return self.db.execute(statement).unique().scalar_one_or_none()

    def count_indexed(self, *, model_name: str) -> int:
        """Count active books with a usable vector from the requested model."""
        statement = (
            select(func.count())
            .select_from(BookEmbedding)
            .join(Book, Book.id == BookEmbedding.book_id)
            .where(
                Book.deleted_at.is_(None),
                BookEmbedding.embedding_status == EmbeddingStatus.INDEXED,
                BookEmbedding.embedding.is_not(None),
                BookEmbedding.model_name == model_name,
            )
        )
        return self.db.execute(statement).scalar_one()

    def get(self, book_id: UUID) -> BookEmbedding | None:
        """Fetch an embedding row by book id."""
        return self.db.get(BookEmbedding, book_id)

    def list_stale_books(
        self,
        *,
        limit: int,
        force: bool,
        model_name: str,
        hash_for_book: Callable[[Book], str],
    ) -> list[Book]:
        """Return active books whose embedding is missing or out of date.

        ``hash_for_book`` computes the expected canonical-text hash so
        content drift (edits since last index) counts as stale.
        """
        statement = self._book_with_relations().order_by(Book.created_at)
        books = self.db.execute(statement).unique().scalars().all()

        stale: list[Book] = []
        for book in books:
            if force:
                stale.append(book)
            else:
                row = book.embedding
                needs_work = (
                    row is None
                    or row.embedding_status != EmbeddingStatus.INDEXED
                    or row.embedding is None
                    or row.model_name != model_name
                    or row.content_hash != hash_for_book(book)
                )
                if needs_work:
                    stale.append(book)
            if len(stale) >= limit:
                break
        return stale

    def has_stale_books(
        self,
        *,
        model_name: str,
        hash_for_book: Callable[[Book], str],
    ) -> bool:
        """Return whether any active catalog entry is not represented by its current vector."""
        return bool(
            self.list_stale_books(
                limit=1,
                force=False,
                model_name=model_name,
                hash_for_book=hash_for_book,
            )
        )

    def upsert_indexed(
        self,
        *,
        book_id: UUID,
        embedding: list[float],
        content_hash: str,
        model_name: str,
        model_version: str,
    ) -> None:
        """Persist a successful embedding."""
        now = datetime.now(UTC)
        row = self.db.get(BookEmbedding, book_id)
        if row is None:
            row = BookEmbedding(book_id=book_id)
            self.db.add(row)
        row.embedding = embedding
        row.content_hash = content_hash
        row.model_name = model_name
        row.model_version = model_version
        row.embedding_status = EmbeddingStatus.INDEXED
        row.indexed_at = now
        row.last_error = None

    def mark_pending(self, *, book_id: UUID, content_hash: str) -> None:
        """Flag a book whose content changed and needs re-indexing."""
        row = self.db.get(BookEmbedding, book_id)
        if row is None:
            row = BookEmbedding(book_id=book_id)
            self.db.add(row)
        if row.embedding_status == EmbeddingStatus.INDEXED and row.content_hash != content_hash:
            row.embedding = None
        row.embedding_status = EmbeddingStatus.PENDING
        row.content_hash = content_hash
        row.indexed_at = None
        row.last_error = None

    def mark_failed(self, *, book_id: UUID, content_hash: str, error: str) -> None:
        """Record an indexing failure for diagnostics."""
        row = self.db.get(BookEmbedding, book_id)
        if row is None:
            row = BookEmbedding(book_id=book_id)
            self.db.add(row)
        row.content_hash = content_hash
        row.embedding_status = EmbeddingStatus.FAILED
        row.last_error = error[:2000]

    def delete_for_book(self, book_id: UUID) -> None:
        """Remove the embedding row for a deleted book."""
        self.db.execute(delete(BookEmbedding).where(BookEmbedding.book_id == book_id))

    def search_similar(
        self,
        *,
        query_vector: list[float],
        limit: int,
        model_name: str,
    ) -> list[tuple[Book, float]]:
        """Return nearest active books indexed with the current model."""
        distance = BookEmbedding.embedding.cosine_distance(query_vector).label("distance")
        statement = (
            self._book_with_relations()
            .options(selectinload(Book.copies))
            .join(BookEmbedding, BookEmbedding.book_id == Book.id)
            .add_columns(distance)
            .where(
                BookEmbedding.embedding_status == EmbeddingStatus.INDEXED,
                BookEmbedding.embedding.is_not(None),
                BookEmbedding.model_name == model_name,
            )
            .order_by(distance)
            .limit(limit)
        )
        rows = self.db.execute(statement).unique().all()
        return [(book, 1.0 - float(distance)) for book, distance in rows]
