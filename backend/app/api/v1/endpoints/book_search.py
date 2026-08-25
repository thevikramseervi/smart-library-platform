"""Semantic book search endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.book import SemanticSearchResponse, SemanticSearchResult
from app.services.book_service import BookService
from app.services.embedding_service import EmbeddingService

router = APIRouter()


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

    Falls back to keyword matching over titles/ISBN/authors/publishers when
    no embeddings have been built yet.
    """
    embedding_service = EmbeddingService(db)
    indexed_books = embedding_service.repository.count_indexed()

    if settings.SEMANTIC_SEARCH_ENABLED and indexed_books > 0:
        hits = embedding_service.semantic_search(query=q, limit=limit)
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
