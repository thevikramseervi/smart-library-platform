"""Configuration validation tests."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

VALID_URL = "postgresql+psycopg://user:pass@localhost:5432/db"


def _settings(**overrides) -> dict:
    base = {
        "DATABASE_URL": VALID_URL,
        "JWT_SECRET_KEY": "x" * 32,
        "_env_file": None,
    }
    base.update(overrides)
    return base


def test_strong_secret_accepted() -> None:
    s = Settings(**_settings())
    assert s.JWT_SECRET_KEY == "x" * 32


@pytest.mark.parametrize(
    "secret",
    [
        "change-me-in-production",
        "dev-secret-key-change-in-production",
        "short",
        "",
        "  ",
    ],
)
def test_weak_secrets_rejected(secret: str) -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(**_settings(JWT_SECRET_KEY=secret))


def test_insecure_escape_hatch_allows_weak_secret() -> None:
    s = Settings(**_settings(JWT_SECRET_KEY="change-me-in-production", ALLOW_INSECURE_SECRETS=True))
    assert s.JWT_SECRET_KEY == "change-me-in-production"
