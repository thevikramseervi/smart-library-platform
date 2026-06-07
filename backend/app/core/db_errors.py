"""Database error helpers."""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def commit_or_raise_conflict(db: Session, *, detail: str = "Resource conflict") -> None:
    """Commit the session or translate unique constraint violations to HTTP 409."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
