"""SQL LIKE pattern helpers."""

_LIKE_ESCAPE_CHARS = ("\\", "%", "_")


def escape_like(value: str) -> str:
    """Escape LIKE wildcards so user input matches literally."""
    escaped = value
    for char in _LIKE_ESCAPE_CHARS:
        escaped = escaped.replace(char, f"\\{char}")
    return escaped


def contains_pattern(value: str) -> str:
    """Return an escaped case-insensitive 'contains' LIKE pattern."""
    return f"%{escape_like(value.strip())}%"
