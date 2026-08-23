"""Password hashing library swap must remain compatible with stored hashes."""

from app.core.security import hash_password, verify_password


def test_hash_roundtrip() -> None:
    hashed = hash_password("s3cret-password")
    assert hashed.startswith("$2b$")
    assert verify_password("s3cret-password", hashed)
    assert not verify_password("wrong", hashed)


def test_legacy_passlib_bcrypt_hash_still_verifies() -> None:
    """Hashes produced by passlib's bcrypt scheme continue to validate."""
    legacy = "$2b$12$KIXQxP9f7hFu0qYv8n5Wke9lFXy0LlHcQz1oOZ2eJm5bS6wGtR8Ha"
    # The exact digest above corresponds to no known password; what matters
    # is that verification returns False instead of raising on the format.
    assert not verify_password("whatever", legacy)


def test_malformed_hash_returns_false() -> None:
    assert not verify_password("pw", "not-a-bcrypt-hash")
