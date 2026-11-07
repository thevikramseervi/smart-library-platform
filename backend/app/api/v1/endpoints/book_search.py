"""Semantic book search endpoint."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.book import SemanticSearchResponse, SemanticSearchResult
from app.services.book_service import BookService
from app.services.embedding_service import EmbeddingService

router = APIRouter()
logger = logging.getLogger(__name__)


def _to_result(book, score: float) -> SemanticSearchResult:
    return SemanticSearchResult(
        score=round(score, 4),
        id=book.id,
        title=book.title,
        isbn=book.isbn,
        publication_year=book.publication_year,
        authors=[author.name for author in book.authors],
        categories=[category.name for category in book.categories],
    )


@router.get("/search", response_model=SemanticSearchResponse)
def semantic_search(
    q: str = Query(min_length=1, max_length=512),
    limit: int = Query(default=10, ge=1, le=50),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SemanticSearchResponse:
    """Natural-language search over indexed catalog content.

    Uses keyword matching while embeddings are missing or stale, and whenever
    the semantic provider is unavailable, so recent catalog edits stay searchable.
    """
    embedding_service = EmbeddingService(db)
    indexed_books = embedding_service.repository.count_indexed()

    index_is_current = not embedding_service.repository.has_stale_books(
        hash_for_book=embedding_service.hash_for_book,
    )
    if settings.SEMANTIC_SEARCH_ENABLED and indexed_books > 0 and index_is_current:
        try:
            hits = embedding_service.semantic_search(query=q, limit=limit)
        except Exception:  # noqa: BLE001 - keyword search keeps the catalog usable
            logger.exception("Semantic search failed; falling back to keyword search")
        else:
            return SemanticSearchResponse(
                query=q,
                indexed_books=indexed_books,
                used_semantic=True,
                results=[_to_result(book, score) for book, score in hits],
            )

    service = BookService(db)
    books, _total = service.repository.list_books(page=1, page_size=limit, q=q)
    return SemanticSearchResponse(
        query=q,
        indexed_books=indexed_books,
        used_semantic=False,
        results=[_to_result(book, 1.0) for book in books],
    )
