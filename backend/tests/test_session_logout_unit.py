"""Exercise per-token logout without a database connection."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.security import create_access_token
from app.services.auth_service import AuthService


def test_logout_revokes_only_the_current_token() -> None:
    user = SimpleNamespace(id=uuid4(), is_active=True, token_version=0)
    revoked = set()

    class Repository:
        def get_by_id(self, user_id):
            return user if user_id == user.id else None

        def is_revoked(self, digest):
            return digest in revoked

        def revoke(self, digest, expires_at):
            revoked.add(digest)

    service = AuthService(SimpleNamespace(commit=lambda: None))
    service.repository = Repository()
    first = create_access_token(user.id)
    second = create_access_token(user.id)
    assert first != second
    assert service.authenticate_token(first) is user
    service.logout(first)
    with pytest.raises(HTTPException) as error:
        service.authenticate_token(first)
    assert error.value.status_code == 401
    assert service.authenticate_token(second) is user
