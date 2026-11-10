"""Semantic search indexing and querying."""

from __future__ import annotations

import logging
from collections.abc import Callable
from time import perf_counter
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book
from app.repositories.embedding_repository import EmbeddingRepository
from app.search.document_builder import build_canonical_text, compute_content_hash
from app.search.provider import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)
_BGE_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def _search_query_text(query: str, model_name: str) -> str:
    """Apply BGE v1.5's retrieval instruction to queries, never to documents."""
    normalized_model = model_name.casefold()
    if normalized_model.startswith("baai/bge-") and normalized_model.endswith("-v1.5"):
        return f"{_BGE_QUERY_INSTRUCTION}{query}"
    return query


class EmbeddingService:
    """Index books into vectors and answer semantic queries."""

    def __init__(self, db: Session, provider: EmbeddingProvider | None = None) -> None:
        self.repository = EmbeddingRepository(db)
        self.db = db
        self.provider = provider or get_embedding_provider()
        self.last_search_timings: dict[str, float] = {}

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
        self.mark_books_pending([UUID(book_id)])
        self.db.commit()

    def mark_books_pending(self, book_ids: list[UUID]) -> None:
        """Mark existing active books pending in the current transaction."""
        for book_id in set(book_ids):
            book = self.repository.get_book_with_relations(book_id)
            if book is not None:
                self.repository.mark_pending(
                    book_id=book.id,
                    content_hash=self.hash_for_book(book),
                )

    def reindex_book(self, book_id: str) -> bool:
        """Regenerate one book vector if its catalog content is still current."""
        parsed_id = UUID(book_id)
        book = self.repository.get_book_with_relations(parsed_id)
        if book is None:
            return False

        canonical_text = build_canonical_text(book)
        content_hash = compute_content_hash(canonical_text)
        # Release the read transaction while model inference runs; re-read and
        # lock the catalog row before saving to guard against concurrent edits.
        self.db.rollback()
        try:
            vector = self.provider.embed_texts([canonical_text])[0]
        except Exception as exc:  # noqa: BLE001 - leave a retryable FAILED state
            self.db.rollback()
            self._mark_failed_if_current(parsed_id, content_hash, exc)
            logger.exception("Embedding generation failed for book %s", book_id)
            return False

        try:
            # Lock the catalog row before persisting so an older task cannot
            # overwrite a newer edit's embedding.
            current = self.repository.get_book_with_relations(parsed_id, for_update=True)
            if current is None or self.hash_for_book(current) != content_hash:
                self.db.rollback()
                return False
            self.repository.upsert_indexed(
                book_id=parsed_id,
                embedding=vector,
                content_hash=content_hash,
                model_name=self.provider.model_name,
                model_version="",
            )
            self.db.commit()
            return True
        except Exception:  # noqa: BLE001 - pending rows remain eligible for offline retry
            self.db.rollback()
            logger.exception("Could not persist embedding for book %s", book_id)
            return False

    def _mark_failed_if_current(
        self,
        book_id: UUID,
        content_hash: str,
        error: Exception,
    ) -> None:
        """Mark failure only if the failed task still represents current content."""
        try:
            current = self.repository.get_book_with_relations(book_id, for_update=True)
            if current is None or self.hash_for_book(current) != content_hash:
                self.db.rollback()
                return
            self.repository.mark_failed(
                book_id=book_id,
                content_hash=content_hash,
                error=str(error),
            )
            self.db.commit()
        except Exception:  # noqa: BLE001 - leave pending for the reindex command
            self.db.rollback()
            logger.exception("Could not record embedding failure for book %s", book_id)

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
                    model_name=self.provider.model_name,
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
                    current = self.repository.get_book_with_relations(book.id, for_update=True)
                    if current is not None and self.hash_for_book(current) == content_hash:
                        self.repository.mark_failed(
                            book_id=book.id,
                            content_hash=content_hash,
                            error=str(exc),
                        )
                        stats["failed"] += 1
                self.db.commit()
                break

            for book, content_hash, vector in zip(books, hashes, vectors, strict=True):
                try:
                    # A catalog edit can race the batch inference. Lock and
                    # compare before persisting so an older vector never
                    # replaces the embedding for newer book content.
                    current = self.repository.get_book_with_relations(book.id, for_update=True)
                    if current is None or self.hash_for_book(current) != content_hash:
                        continue
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
        search_text = _search_query_text(query, self.provider.model_name)
        started = perf_counter()
        vector = self.provider.embed_texts([search_text])[0]
        embedded_at = perf_counter()
        results = self.repository.search_similar(
            query_vector=vector,
            limit=limit,
            model_name=self.provider.model_name,
        )
        self.last_search_timings = {
            "embedding_ms": (embedded_at - started) * 1000,
            "vector_query_ms": (perf_counter() - embedded_at) * 1000,
        }
        logger.info(
            "semantic search timing embedding_ms=%.2f vector_query_ms=%.2f results=%d",
            self.last_search_timings["embedding_ms"],
            self.last_search_timings["vector_query_ms"],
            len(results),
        )
        # Similarity values are model- and corpus-dependent. Preserve the
        # nearest ranked hits instead of applying an uncalibrated zero cutoff.
        return results


def reindex_book_in_background(book_id: str) -> None:
    """Open an independent session and index one edited book after the response."""
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        indexed = EmbeddingService(db).reindex_book(book_id)
        if not indexed:
            logger.warning("Background embedding reindex did not finish for book %s", book_id)


def get_embedding_reindexer() -> Callable[[str], None]:
    """Dependency hook used by book routes to schedule background indexing."""
    return reindex_book_in_background
