"""Semantic search pipeline and endpoint tests."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models.book_embedding import BookEmbedding
from app.search import provider as provider_module
from app.services.embedding_service import EmbeddingService
from tests.conftest_circulation import admin_token, catalog_book_with_copy  # noqa: F401
from tests.fake_embedding import FakeEmbeddingProvider


@pytest.fixture(autouse=True)
def _fake_provider() -> Generator[FakeEmbeddingProvider, None, None]:
    """Swap the cached provider for a deterministic fake during each test."""
    fake = FakeEmbeddingProvider()
    original = provider_module._provider
    provider_module.set_embedding_provider(fake)
    yield fake
    provider_module.set_embedding_provider(original)


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _request_db() -> object:
    from app.core.database import get_db

    return next(iter(app.dependency_overrides[get_db]()))


def _create_book(client: TestClient, token: str, title: str, description: str) -> dict:
    suffix = title.lower().replace(" ", "-")
    languages = client.get("/api/v1/languages", headers=_headers(token)).json()
    english = next(lang for lang in languages if lang["code"] == "en")
    publisher = client.post(
        "/api/v1/publishers",
        headers=_headers(token),
        json={"name": f"Semantic Publisher {suffix}"},
    ).json()
    response = client.post(
        "/api/v1/books",
        headers=_headers(token),
        json={
            "title": title,
            "publisher_id": publisher["id"],
            "language_id": english["id"],
            "description": description,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_new_books_are_marked_pending(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Catalog writes flag their embedding row for the reindexer."""
    book = _create_book(client, admin_token, "Pending Marker Book", "A pending marker.")

    row = _request_db().execute(  # type: ignore[union-attr]
        select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
    ).scalar_one_or_none()
    assert row is not None
    assert row.embedding_status.value == "PENDING"
    assert row.embedding is None
    assert row.model_name is None


def test_reindex_and_semantic_search_roundtrip(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Reindex embeds stale books; /books/search then returns scored hits."""
    headers = _headers(admin_token)
    _create_book(client, admin_token, "Quantum Gardening", "Growing plants with qubits.")

    stats = EmbeddingService(_request_db()).reindex_all()  # type: ignore[arg-type]
    assert stats["indexed"] >= 1

    response = client.get(
        "/api/v1/books/search",
        headers=headers,
        params={"q": "quantum gardening", "limit": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["used_semantic"] is True
    assert body["indexed_books"] >= 1
    matching = [r for r in body["results"] if r["title"] == "Quantum Gardening"]
    assert matching, body
    assert matching[0]["score"] > 0.0


def test_search_falls_back_to_keyword_without_index(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """With zero indexed books the endpoint answers via keyword matching."""
    book = _create_book(client, admin_token, "Fallback Keyword Book", "Plain text.")

    response = client.get(
        "/api/v1/books/search",
        headers=_headers(admin_token),
        params={"q": "Fallback Keyword"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["used_semantic"] is False
    assert any(item["id"] == book["id"] for item in body["results"])


def test_content_edits_make_embedding_stale(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Editing a book invalidates its hash so reindex embeds it again."""
    headers = _headers(admin_token)
    book = _create_book(client, admin_token, "Staleness Probe", "Original description.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]

    assert service.reindex_all()["indexed"] >= 1
    row = _request_db().execute(  # type: ignore[union-attr]
        select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
    ).scalar_one()
    assert row.embedding_status.value == "INDEXED"
    hash_before = row.content_hash

    update = client.put(
        f"/api/v1/books/{book['id']}",
        headers=headers,
        json={"description": "Rewritten description changes the canonical text."},
    )
    assert update.status_code == 200

    fresh_row = _request_db().execute(  # type: ignore[union-attr]
        select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
    ).scalar_one()
    assert fresh_row.embedding_status.value == "PENDING"
    assert fresh_row.content_hash != hash_before

    rerun = service.reindex_all()
    assert rerun["indexed"] >= 1
    refreshed = _request_db().execute(  # type: ignore[union-attr]
        select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
    ).scalar_one()
    assert refreshed.embedding_status.value == "INDEXED"


def test_soft_deleted_book_drops_from_index(
    client: TestClient,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Soft-deleted books are excluded from semantic results."""
    headers = _headers(admin_token)
    data = catalog_book_with_copy
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]

    service.reindex_all()
    before = client.get(
        "/api/v1/books/search",
        headers=headers,
        params={"q": data["inventory_code"], "limit": 50},
    ).json()
    assert any(r["id"] == data["book_id"] for r in before["results"]) or not before["results"]

    # Retire the copy so delete_book's guard allows soft deletion.
    retired = client.put(
        f"/api/v1/book-copies/{data['copy_id']}",
        headers=headers,
        json={"status": "RETIRED"},
    )
    assert retired.status_code == 200

    deleted = client.delete(f"/api/v1/books/{data['book_id']}", headers=headers)
    assert deleted.status_code == 204

    service.reindex_all(force=True)
    after = client.get(
        "/api/v1/books/search",
        headers=headers,
        params={"q": data["inventory_code"], "limit": 50},
    ).json()
    assert all(r["id"] != data["book_id"] for r in after["results"])
