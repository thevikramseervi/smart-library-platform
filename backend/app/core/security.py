"""Security utilities for password hashing and JWT tokens."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt
from pydantic import BaseModel

from app.core.config import settings

BCRYPT_ROUNDS = 12


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash.

    Returns False rather than raising when the stored hash is malformed.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: UUID, *, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT containing only sub, iat, and exp claims."""
    now = datetime.now(UTC)
    expire_at = now + (
        expires_delta if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid or expired token") from exc

    subject = payload.get("sub")
    if subject is None:
        raise ValueError("Invalid token payload")

    return TokenPayload(sub=subject)
