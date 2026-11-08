"""Admin controls for semantic search indexing."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.config import settings
from app.models.book import Book
from app.models.book_embedding import BookEmbedding, EmbeddingStatus
from app.models.user import User
from app.schemas.search_index import (
    SearchIndexJobAccepted,
    SearchIndexRequest,
    SearchIndexStatus,
)
from app.services.embedding_jobs import get_current_job, run_job, start_job

router = APIRouter()


@router.get("/status", response_model=SearchIndexStatus)
def get_search_index_status(
    _admin: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
) -> SearchIndexStatus:
    """Return catalog indexing counts and the latest bulk job state."""
    total = db.execute(
        select(func.count()).select_from(Book).where(Book.deleted_at.is_(None))
    ).scalar_one()
    indexed = db.execute(
        select(func.count())
        .select_from(BookEmbedding)
        .join(Book, Book.id == BookEmbedding.book_id)
        .where(
            Book.deleted_at.is_(None),
            BookEmbedding.embedding_status == EmbeddingStatus.INDEXED,
            BookEmbedding.embedding.is_not(None),
            BookEmbedding.model_name == settings.EMBEDDING_MODEL,
        )
    ).scalar_one()
    failed = db.execute(
        select(func.count())
        .select_from(BookEmbedding)
        .join(Book, Book.id == BookEmbedding.book_id)
        .where(
            Book.deleted_at.is_(None),
            BookEmbedding.embedding_status == EmbeddingStatus.FAILED,
        )
    ).scalar_one()
    return SearchIndexStatus(
        total_books=total,
        indexed_books=indexed,
        pending_books=max(total - indexed - failed, 0),
        failed_books=failed,
        enabled=settings.SEMANTIC_SEARCH_ENABLED,
        model_name=settings.EMBEDDING_MODEL,
        job=get_current_job(),
    )


@router.post(
    "/reindex", response_model=SearchIndexJobAccepted, status_code=status.HTTP_202_ACCEPTED
)
def request_reindex(
    payload: SearchIndexRequest,
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_roles("ADMIN")),
) -> SearchIndexJobAccepted:
    """Retry pending/failed books or explicitly rebuild every embedding."""
    if not settings.SEMANTIC_SEARCH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Semantic search is disabled.",
        )
    try:
        job = start_job(force=payload.force)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    background_tasks.add_task(run_job, job.id, force=payload.force)
    return SearchIndexJobAccepted(job_id=job.id, status="RUNNING", mode=job.mode)
