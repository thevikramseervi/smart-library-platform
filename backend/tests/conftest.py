"""Pytest configuration and shared fixtures."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import login_rate_limiter
from app.db.seed import (
    seed_departments,
    seed_dev_admin,
    seed_dev_librarian,
    seed_dev_student,
    seed_dev_student_two,
    seed_languages,
    seed_roles,
)
from app.main import app
from tests.db import TestingSessionLocal, test_engine

pytest_plugins = ["tests.conftest_circulation"]


@pytest.fixture
def db_connection() -> Generator[Connection, None, None]:
    """Open a connection wrapped in an outer transaction that is rolled back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        transaction.rollback()
        connection.close()


@pytest.fixture
def db_session(
    _reset_login_rate_limiter: None,
    db_connection: Connection,
) -> Generator[Session, None, None]:
    """Provide a request-scoped SQLAlchemy session that never commits to the real database."""
    session = TestingSessionLocal(bind=db_connection)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _reset_login_rate_limiter() -> None:
    """Clear login lockout state between tests."""
    login_rate_limiter.reset()


@pytest.fixture(autouse=True)
def _seed_reference_data(db_session: Session) -> None:
    """Seed reference data inside the rolled-back test transaction.

    Roles, departments, dev users, and languages are idempotent and scoped to
    the outer transaction, so every test starts from a clean, fully seeded state.
    """
    roles = seed_roles(db_session)
    seed_departments(db_session)
    seed_dev_admin(db_session, roles["ADMIN"])
    seed_dev_librarian(db_session, roles["LIBRARIAN"])
    seed_dev_student(db_session, roles["STUDENT"])
    seed_dev_student_two(db_session, roles["STUDENT"])
    seed_languages(db_session)
    db_session.flush()


@pytest.fixture
def client(_seed_reference_data: None, db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI test client backed by the isolated test session.

    Depends on the seeding fixture explicitly so reference data always exists
    before any API call, independent of autouse fixture ordering.
    """

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
