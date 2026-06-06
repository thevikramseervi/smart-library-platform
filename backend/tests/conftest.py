"""Pytest configuration and shared fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Provide a FastAPI test client."""
    with TestClient(app) as test_client:
        yield test_client
