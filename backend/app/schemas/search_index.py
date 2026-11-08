"""Schemas for semantic search indexing administration."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SearchIndexJob(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mode: Literal["RETRY", "FULL"]
    status: Literal["RUNNING", "COMPLETED", "FAILED"]
    started_at: datetime
    finished_at: datetime | None = None
    scanned: int = 0
    indexed: int = 0
    failed: int = 0
    error: str | None = None


class SearchIndexStatus(BaseModel):
    total_books: int
    indexed_books: int
    pending_books: int
    failed_books: int
    enabled: bool
    model_name: str
    job: SearchIndexJob | None = None


class SearchIndexRequest(BaseModel):
    force: bool = False


class SearchIndexJobAccepted(BaseModel):
    job_id: str
    status: Literal["RUNNING"]
    mode: Literal["RETRY", "FULL"]
