"""Login rate limiting and account lockout tests."""

from fastapi.testclient import TestClient

from app.core.config import settings


def _login(client: TestClient, email: str, password: str):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def test_lockout_after_max_failed_attempts(client: TestClient) -> None:
    """Repeated failures lock the account even for the correct password."""
    for _ in range(settings.LOGIN_RATE_LIMIT_ATTEMPTS):
        response = _login(client, settings.DEV_ADMIN_EMAIL, "wrong-password")
        assert response.status_code == 401

    locked = _login(client, settings.DEV_ADMIN_EMAIL, settings.DEV_ADMIN_PASSWORD)
    assert locked.status_code == 429
    assert "Too many failed login attempts" in locked.json()["detail"]


def test_successful_login_resets_failure_history(client: TestClient) -> None:
    """A successful login clears accumulated failures for the account."""
    for _ in range(settings.LOGIN_RATE_LIMIT_ATTEMPTS - 1):
        assert _login(client, settings.DEV_ADMIN_EMAIL, "wrong-password").status_code == 401

    success = _login(client, settings.DEV_ADMIN_EMAIL, settings.DEV_ADMIN_PASSWORD)
    assert success.status_code == 200

    for _ in range(settings.LOGIN_RATE_LIMIT_ATTEMPTS - 1):
        assert _login(client, settings.DEV_ADMIN_EMAIL, "wrong-password").status_code == 401

    recovery = _login(client, settings.DEV_ADMIN_EMAIL, settings.DEV_ADMIN_PASSWORD)
    assert recovery.status_code == 200


def test_lockout_is_per_account(client: TestClient) -> None:
    """Locking one account does not affect other accounts."""
    for _ in range(settings.LOGIN_RATE_LIMIT_ATTEMPTS + 1):
        _login(client, "nobody@library.local", "wrong-password")

    other = client.post(
        "/api/v1/auth/login",
        json={"email": settings.DEV_LIBRARIAN_EMAIL, "password": settings.DEV_LIBRARIAN_PASSWORD},
    )
    assert other.status_code == 200


def test_unknown_email_locks_after_threshold(client: TestClient) -> None:
    """Enumeration via unknown emails is throttled identically."""
    for _ in range(settings.LOGIN_RATE_LIMIT_ATTEMPTS):
        assert _login(client, "ghost@library.local", "whatever").status_code == 401

    locked = _login(client, "ghost@library.local", "whatever")
    assert locked.status_code == 429
