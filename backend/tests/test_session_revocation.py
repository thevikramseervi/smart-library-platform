"""Password resets must revoke outstanding JWTs immediately."""

from fastapi.testclient import TestClient

from app.db.seed import DEV_STUDENT_EMAIL
from tests.conftest_circulation import admin_token, student_token  # noqa: F401


def test_reset_password_revokes_existing_token(
    client: TestClient,
    db_session,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
) -> None:
    """A stolen token stops working the moment an admin resets the password."""
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student_token}"}).json()
    old_token = student_token

    reset = client.post(
        f"/api/v1/users/{me['id']}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": "brand-new-password-123"},
    )
    assert reset.status_code == 204

    revoked = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert revoked.status_code == 401

    relogin = client.post(
        "/api/v1/auth/login",
        json={"email": DEV_STUDENT_EMAIL, "password": "brand-new-password-123"},
    )
    assert relogin.status_code == 200


def test_password_change_via_update_revokes_sessions(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Changing a password through user update also invalidates prior tokens."""
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"}).json()
    old_token = admin_token

    update = client.put(
        f"/api/v1/users/{me['id']}",
        headers={"Authorization": f"Bearer {old_token}"},
        json={"password": "rotated-admin-password-1"},
    )
    assert update.status_code == 200

    revoked = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert revoked.status_code == 401
