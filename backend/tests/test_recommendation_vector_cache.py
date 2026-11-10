"""Checks for revision-checked recommendation vector caching."""

from uuid import uuid4

from app.repositories.recommendation_vector_cache import RecommendationVectorCache


def test_cache_isolated_copied_and_invalidated_by_revision(monkeypatch) -> None:
    now = [100.0]
    monkeypatch.setattr("app.repositories.recommendation_vector_cache.monotonic", lambda: now[0])
    cache = RecommendationVectorCache(ttl_seconds=30)
    key = (object(), "model")
    book_id = uuid4()
    cache.put(key, "revision-a", {book_id: [1.0, 2.0]})

    cached = cache.get(key, "revision-a")
    assert cached == {book_id: [1.0, 2.0]}
    assert cached is not None
    cached[book_id][0] = 99.0
    assert cache.get(key, "revision-a") == {book_id: [1.0, 2.0]}
    assert cache.get((object(), "model"), "revision-a") is None
    assert cache.get(key, "revision-b") is None

    cache.put(key, "revision-b", {book_id: [3.0]})
    now[0] += 30
    assert cache.get(key, "revision-b") is None
