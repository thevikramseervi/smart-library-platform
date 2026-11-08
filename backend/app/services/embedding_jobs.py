"""Process-local tracking and execution for manually requested reindex jobs."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

from app.core.database import SessionLocal
from app.schemas.search_index import SearchIndexJob
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)
_lock = Lock()
_job: SearchIndexJob | None = None


def get_current_job() -> SearchIndexJob | None:
    """Return a safe snapshot of the latest manually requested job."""
    with _lock:
        return _job.model_copy(deep=True) if _job else None


def start_job(*, force: bool) -> SearchIndexJob:
    """Reserve the single bulk job slot, rejecting overlapping bulk work."""
    global _job
    with _lock:
        if _job is not None and _job.status == "RUNNING":
            raise RuntimeError("A reindex job is already running.")
        _job = SearchIndexJob(
            id=str(uuid4()),
            mode="FULL" if force else "RETRY",
            status="RUNNING",
            started_at=datetime.now(UTC),
        )
        return _job.model_copy(deep=True)


def run_job(job_id: str, *, force: bool) -> None:
    """Run a bulk reindex on its own database session and record its outcome."""
    global _job
    try:
        with SessionLocal() as db:
            stats = EmbeddingService(db).reindex_all(force=force)
        with _lock:
            if _job is not None and _job.id == job_id:
                _job = _job.model_copy(
                    update={
                        **stats,
                        "status": "COMPLETED",
                        "finished_at": datetime.now(UTC),
                    }
                )
    except Exception as exc:  # noqa: BLE001 - surface job failure in the admin UI
        logger.exception("Manual semantic reindex job %s failed", job_id)
        with _lock:
            if _job is not None and _job.id == job_id:
                _job = _job.model_copy(
                    update={
                        "status": "FAILED",
                        "finished_at": datetime.now(UTC),
                        "error": str(exc)[:500],
                    }
                )
