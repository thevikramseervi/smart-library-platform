"""Isolated database engine and session factory for pytest."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

TEST_DATABASE_URL = settings.TEST_DATABASE_URL or settings.DATABASE_URL

test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    join_transaction_mode="create_savepoint",
)
