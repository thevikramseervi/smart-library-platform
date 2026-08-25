"""Semantic search indexing and querying."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book
from app.repositories.embedding_repository import EmbeddingRepository
from app.search.document_builder import build_canonical_text, compute_content_hash
from app.search.provider import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Index books into vectors and answer semantic queries."""

    def __init__(self, db: Session, provider: EmbeddingProvider | None = None) -> None:
        self.repository = EmbeddingRepository(db)
        self.db = db
        self.provider = provider or get_embedding_provider()

    @staticmethod
    def hash_for_book(book: Book) -> str:
        """Compute the canonical-text hash used for staleness checks."""
        return compute_content_hash(build_canonical_text(book))

    def mark_book_pending(self, book_id: str) -> None:
        """Flag a book as needing re-indexing after a catalog change.

        Cheap on purpose: no model is loaded; the reindex command does the
        heavy work later. Relations are re-fetched so the stored hash always
        reflects committed content.
        """
        from uuid import UUID

        book = self.repository.get_book_with_relations(UUID(book_id))
        if book is None:
            return
        self.repository.mark_pending(
            book_id=book.id,
            content_hash=self.hash_for_book(book),
        )
        self.db.commit()

    def clear_book(self, book_id: str) -> None:
        """Drop the embedding row when a book leaves the catalog."""
        self.repository.delete_for_book(book_id)
        self.db.commit()

    def reindex_all(
        self,
        *,
        batch_size: int = 32,
        force: bool = False,
        limit: int | None = None,
    ) -> dict[str, int]:
        """Embed every stale active book in batches.

        Returns counters: scanned, indexed, skipped, failed.
        """
        stats = {"scanned": 0, "indexed": 0, "failed": 0}
        remaining = limit if limit is not None else batch_size * 10000
        processed: set[str] = set()

        while remaining > 0:
            candidates = [
                book
                for book in self.repository.list_stale_books(
                    limit=batch_size * 2,
                    force=force,
                    hash_for_book=self.hash_for_book,
                )
                if str(book.id) not in processed
            ]
            books = candidates[:batch_size]
            if not books:
                break
            for book in books:
                processed.add(str(book.id))

            texts = [build_canonical_text(book) for book in books]
            hashes = [compute_content_hash(text) for text in texts]
            stats["scanned"] += len(books)

            try:
                vectors = self.provider.embed_texts(texts)
            except Exception as exc:  # noqa: BLE001 - batch failure is recoverable per-book
                logger.exception("Embedding batch failed")
                for book, content_hash in zip(books, hashes, strict=True):
                    self.repository.mark_failed(
                        book_id=book.id,
                        content_hash=content_hash,
                        error=str(exc),
                    )
                stats["failed"] += len(books)
                break

            for book, content_hash, vector in zip(books, hashes, vectors, strict=True):
                try:
                    self.repository.upsert_indexed(
                        book_id=book.id,
                        embedding=vector,
                        content_hash=content_hash,
                        model_name=self.provider.model_name,
                        model_version="",
                    )
                    stats["indexed"] += 1
                except Exception as exc:  # noqa: BLE001
                    self.repository.mark_failed(
                        book_id=book.id,
                        content_hash=content_hash,
                        error=str(exc),
                    )
                    stats["failed"] += 1

            self.db.commit()
            remaining -= len(books)

        return stats

    def semantic_search(self, *, query: str, limit: int = 10) -> list[tuple[Book, float]]:
        """Return the nearest indexed books to a natural-language query."""
        if not settings.SEMANTIC_SEARCH_ENABLED:
            return []
        vector = self.provider.embed_texts([query])[0]
        results = self.repository.search_similar(query_vector=vector, limit=limit)
        return [(book, score) for book, score in results if score > 0]
