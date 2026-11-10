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


def _to_result(
    book,
    score: float | None,
    copy_counts: tuple[int, int] = (0, 0),
) -> SemanticSearchResult:
    publisher = getattr(book, "publisher", None)
    return SemanticSearchResult(
        score=round(score, 4) if score is not None else None,
        id=book.id,
        title=book.title,
        cover_image_url=getattr(book, "cover_image_url", None),
        publisher=publisher.name if publisher is not None else None,
        isbn=book.isbn,
        publication_year=book.publication_year,
        authors=[author.name for author in book.authors],
        categories=[category.name for category in book.categories],
        total_copies=copy_counts[0],
        available_copies=copy_counts[1],
    )


def _normalized(value: str | None) -> str:
    """Normalize text for stable title and ISBN comparisons."""
    return "".join(char for char in (value or "").casefold() if char.isalnum())


def _looks_like_isbn(query: str) -> bool:
    """Identify ISBN-10/13 inputs so identifier searches avoid semantic noise."""
    value = _normalized(query)
    return (len(value) == 10 and value[:9].isdigit() and value[-1] in "0123456789x") or (
        len(value) == 13 and value.isdigit()
    )


def _text_match_priority(book, query: str) -> int:
    """Prefer exact title/ISBN matches, then title prefixes, then other text hits."""
    normalized_query = _normalized(query)
    title = _normalized(book.title)
    isbn = _normalized(book.isbn)
    if normalized_query and normalized_query in {title, isbn}:
        return 0
    if normalized_query and title.startswith(normalized_query):
        return 1
    if normalized_query and normalized_query in title:
        return 2
    return 3


def _diversify_semantic_results(
    results: list[SemanticSearchResult],
) -> list[SemanticSearchResult]:
    """Put one result per normalized title first while retaining every edition."""
    unique_titles: list[SemanticSearchResult] = []
    repeated_titles: list[SemanticSearchResult] = []
    seen: set[str] = set()
    for result in results:
        title_key = _normalized(result.title)
        if title_key in seen:
            repeated_titles.append(result)
        else:
            seen.add(title_key)
            unique_titles.append(result)
    return unique_titles + repeated_titles


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
    indexed_books = embedding_service.repository.count_indexed(
        model_name=embedding_service.provider.model_name,
    )
    if _looks_like_isbn(q):
        service = BookService(db)
        books, _total = service.repository.list_books(page=1, page_size=limit, q=q)
        copy_counts = service.repository.get_copy_counts_by_book_ids([book.id for book in books])
        books.sort(key=lambda book: (_text_match_priority(book, q), _normalized(book.title)))
        return SemanticSearchResponse(
            query=q,
            indexed_books=indexed_books,
            used_semantic=False,
            text_match_count=len(books),
            results=[_to_result(book, None, copy_counts[book.id]) for book in books],
        )
    if settings.SEMANTIC_SEARCH_ENABLED and indexed_books > 0:
        try:
            # Over-fetch so editions with the same title do not monopolize the
            # first page after title diversity is applied.
            hits = embedding_service.semantic_search(query=q, limit=min(100, limit * 3))
        except Exception:  # noqa: BLE001 - keyword search keeps the catalog usable
            logger.exception("Semantic search failed; falling back to keyword search")
            db.rollback()
        else:
            service = BookService(db)
            keyword_books, _total = service.repository.list_books(
                page=1,
                page_size=min(100, max(limit, 50)),
                q=q,
            )
            all_result_book_ids = list(
                {book.id for book, _ in hits} | {book.id for book in keyword_books}
            )
            copy_counts = service.repository.get_copy_counts_by_book_ids(all_result_book_ids)
            semantic_results = [
                _to_result(book, score, copy_counts[book.id]) for book, score in hits
            ]
            semantic_by_id = {result.id: result for result in semantic_results}
            ordered_keyword_books = sorted(
                keyword_books,
                key=lambda book: (_text_match_priority(book, q), _normalized(book.title)),
            )
            keyword_results = [
                semantic_by_id.get(book.id)
                or _to_result(book, None, copy_counts[book.id])
                for book in ordered_keyword_books
            ][:limit]
            keyword_ids = {result.id for result in keyword_results}
            text_match_count = sum(result.score is None for result in keyword_results)
            semantic_remainder = _diversify_semantic_results(
                [result for result in semantic_results if result.id not in keyword_ids]
            )
            return SemanticSearchResponse(
                query=q,
                indexed_books=indexed_books,
                used_semantic=True,
                text_match_count=text_match_count,
                # Exact catalog matches should not be buried below merely
                # related vector results (especially while their vector is pending).
                results=(keyword_results + semantic_remainder)[:limit],
            )

    service = BookService(db)
    books, _total = service.repository.list_books(page=1, page_size=limit, q=q)
    copy_counts = service.repository.get_copy_counts_by_book_ids([book.id for book in books])
    books.sort(key=lambda book: (_text_match_priority(book, q), _normalized(book.title)))
    return SemanticSearchResponse(
        query=q,
        indexed_books=indexed_books,
        used_semantic=False,
        text_match_count=len(books),
        results=[_to_result(book, None, copy_counts[book.id]) for book in books],
    )
