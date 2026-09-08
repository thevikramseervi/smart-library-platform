"""Database engine and session configuration."""

from collections.abc import Generator

import socket
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _get_connect_args() -> dict[str, str]:
    """Resolve IPv4 hostaddr directly to avoid OS-level IPv6 connection timeouts."""
    connect_args: dict[str, str] = {}
    try:
        parsed = urlparse(settings.DATABASE_URL)
        if parsed.hostname and not parsed.hostname.startswith("127.") and parsed.hostname != "localhost":
            connect_args["hostaddr"] = socket.gethostbyname(parsed.hostname)
    except Exception:
        pass
    return connect_args


engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_get_connect_args(),
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


def get_db() -> Generator[Session, None, None]:
    """Provide a database session for request-scoped dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
