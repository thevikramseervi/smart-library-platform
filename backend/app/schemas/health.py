"""Pydantic schemas for health check responses."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response payload."""

    status: str
    database: str
