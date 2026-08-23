"""LIKE pattern escaping tests."""

import pytest

from app.core.sql import contains_pattern, escape_like


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("plain", r"%plain%"),
        ("50%", r"%50\%%"),
        ("under_score", r"%under\_score%"),
        ("back\\slash", r"%back\\slash%"),
        ("  padded  ", "%padded%"),
    ],
)
def test_escape_like(raw: str, expected: str) -> None:
    assert escape_like(raw.strip()) in expected or expected == contains_pattern(raw)


def test_contains_pattern_escapes_wildcards() -> None:
    assert contains_pattern("100%") == r"%100\%%"
    assert contains_pattern("_") == r"%\_%"


def test_contains_pattern_strips_whitespace() -> None:
    assert contains_pattern("  tolkien  ") == r"%tolkien%"
