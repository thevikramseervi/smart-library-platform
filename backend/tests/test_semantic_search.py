"""Semantic search pipeline and endpoint tests."""

from collections.abc import Generator
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.endpoints.book_search import (
    _diversify_semantic_results,
    _looks_like_isbn,
    _text_match_priority,
    _to_result,
)
from app.main import app
from app.models.book_embedding import BookEmbedding
from app.schemas.book import SemanticSearchResult
from app.search import provider as provider_module
from app.services.embedding_service import (
    EmbeddingService,
    _search_query_text,
    get_embedding_reindexer,
)
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


def test_keyword_search_result_can_omit_similarity_score() -> None:
    """Keyword matches have no vector similarity score to round or display."""
    book = SimpleNamespace(
        id=uuid4(),
        title="Keyword result",
        cover_image_url="https://covers.example.test/keyword.jpg",
        publisher=SimpleNamespace(name="Campus Press"),
        isbn=None,
        publication_year=None,
        authors=[],
        categories=[],
        copies=[
            SimpleNamespace(status="AVAILABLE"),
            SimpleNamespace(status="BORROWED"),
        ],
    )

    result = _to_result(book, None)

    assert result.score is None
    assert result.cover_image_url == "https://covers.example.test/keyword.jpg"
    assert result.publisher == "Campus Press"
    assert result.total_copies == 2
    assert result.available_copies == 1


def test_bge_v15_search_query_uses_retrieval_instruction() -> None:
    """The BGE instruction is applied to the query, not indexed documents."""
    assert _search_query_text("books about databases", "BAAI/bge-small-en-v1.5") == (
        "Represent this sentence for searching relevant passages: books about databases"
    )
    assert _search_query_text("books about databases", "custom-model") == ("books about databases")


def test_semantic_search_keeps_negative_cosine_scores() -> None:
    """Nearest results are retained; cosine score zero is not a calibrated cutoff."""
    book = SimpleNamespace(id=uuid4())
    service = EmbeddingService(object(), provider=FakeEmbeddingProvider())  # type: ignore[arg-type]
    service.repository.search_similar = lambda **_kwargs: [(book, -0.05)]  # type: ignore[method-assign]

    results = service.semantic_search(query="unrelated query", limit=1)

    assert results == [(book, -0.05)]


def test_text_matches_prioritize_exact_title_isbn_then_prefix() -> None:
    """Exact title and ISBN matches outrank title prefixes and other text hits."""
    exact_title = SimpleNamespace(title="Clean Code", isbn="9780132350884")
    exact_isbn = SimpleNamespace(title="Unrelated title", isbn="978-0-13-235088-4")
    prefix = SimpleNamespace(title="Clean Code: A Handbook", isbn=None)
    contains = SimpleNamespace(title="The Clean Code Companion", isbn=None)
    author_only = SimpleNamespace(title="Software Design", isbn=None)

    assert _text_match_priority(exact_title, " clean-code ") == 0
    assert _text_match_priority(exact_isbn, "9780132350884") == 0
    assert _text_match_priority(prefix, "Clean Code") == 1
    assert _text_match_priority(contains, "Clean Code") == 2
    assert _text_match_priority(author_only, "Clean Code") == 3


def test_isbn_search_bypasses_semantic_ranking() -> None:
    """ISBN-shaped queries use catalog matches instead of unrelated vector hits."""
    assert _looks_like_isbn("978-0-13-235088-4")
    assert _looks_like_isbn("0132350882")
    assert not _looks_like_isbn("books about clean code")
    assert not _looks_like_isbn("978013")


def test_semantic_diversity_moves_repeated_titles_after_unique_titles() -> None:
    """Repeated editions move down but are retained in the result set."""
    first = SemanticSearchResult(
        id=uuid4(),
        title="Learning Python",
        isbn="1",
        publication_year=2020,
        authors=[],
        categories=[],
        score=0.9,
    )
    second = SemanticSearchResult(
        id=uuid4(),
        title="Learning Python",
        isbn="2",
        publication_year=2010,
        authors=[],
        categories=[],
        score=0.8,
    )
    other = SemanticSearchResult(
        id=uuid4(),
        title="Clean Code",
        isbn="3",
        publication_year=2008,
        authors=[],
        categories=[],
        score=0.7,
    )

    ranked = _diversify_semantic_results([first, second, other])

    assert [result.id for result in ranked] == [first.id, other.id, second.id]


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

    row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one_or_none()
    )
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
    book = _create_book(client, admin_token, "Quantum Gardening", "Growing plants with qubits.")

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
    assert body["results"][0]["id"] == book["id"]


def test_create_and_update_schedule_background_reindex(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Catalog writes enqueue one targeted embedding refresh per changed book."""
    scheduled: list[str] = []
    previous = app.dependency_overrides[get_embedding_reindexer]
    app.dependency_overrides[get_embedding_reindexer] = lambda: scheduled.append
    try:
        book = _create_book(client, admin_token, "Background Reindex Book", "First text.")
        update = client.put(
            f"/api/v1/books/{book['id']}",
            headers=_headers(admin_token),
            json={"description": "Updated text."},
        )
        assert update.status_code == 200
    finally:
        app.dependency_overrides[get_embedding_reindexer] = previous

    assert scheduled == [book["id"], book["id"]]


def test_reindex_book_indexes_only_the_current_book(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Targeted indexing persists a current vector for an edited book."""
    book = _create_book(client, admin_token, "Targeted Reindex Book", "Fresh metadata.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]

    assert service.reindex_book(book["id"]) is True
    row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    assert row.embedding_status.value == "INDEXED"
    assert row.embedding is not None
    current_book = service.repository.get_book_with_relations(UUID(book["id"]))
    assert current_book is not None
    assert row.content_hash == service.hash_for_book(current_book)


def test_reindex_book_failure_records_retryable_error(
    client: TestClient,
    admin_token: str,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Failed immediate indexing is recorded and remains eligible for retry."""
    book = _create_book(client, admin_token, "Failed Reindex Book", "Metadata text.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]

    def fail_embedding(_texts: list[str]) -> list[list[float]]:
        raise RuntimeError("temporary embedder failure")

    monkeypatch.setattr(service.provider, "embed_texts", fail_embedding)

    assert service.reindex_book(book["id"]) is False
    row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    assert row.embedding_status.value == "FAILED"
    assert row.last_error == "temporary embedder failure"
    assert service.repository.has_stale_books(
        model_name=service.provider.model_name,
        hash_for_book=service.hash_for_book,
    )


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
    assert all(item["score"] is None for item in body["results"])


def test_search_falls_back_to_keyword_when_embedding_provider_fails(
    client: TestClient,
    admin_token: str,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed semantic query should not make the catalog search unavailable."""
    book = _create_book(
        client,
        admin_token,
        "Provider Failure Fallback",
        "Keyword fallback content.",
    )
    EmbeddingService(_request_db()).reindex_all()  # type: ignore[arg-type]

    def fail_semantic_search(*, query: str, limit: int = 10):
        raise RuntimeError("embedding model is unavailable")

    monkeypatch.setattr(EmbeddingService, "semantic_search", fail_semantic_search)
    response = client.get(
        "/api/v1/books/search",
        headers=_headers(admin_token),
        params={"q": "Provider Failure Fallback"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["used_semantic"] is False
    assert any(item["id"] == book["id"] for item in body["results"])
    assert all(item["score"] is None for item in body["results"])


def test_reindex_marks_embeddings_from_another_model_as_stale(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """A model change must not query vectors created by a different embedder."""
    book = _create_book(client, admin_token, "Model Version Probe", "Embedding model check.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]
    assert service.reindex_all()["indexed"] >= 1

    row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    current_count = service.repository.count_indexed(model_name=service.provider.model_name)
    assert current_count >= 1
    row.model_name = "previous-model"
    _request_db().flush()  # type: ignore[union-attr]

    assert (
        service.repository.count_indexed(
            model_name=service.provider.model_name,
        )
        == current_count - 1
    )
    assert service.repository.has_stale_books(
        model_name=service.provider.model_name,
        hash_for_book=service.hash_for_book,
    )


def test_content_edits_make_embedding_stale(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """Editing a book invalidates its hash so reindex embeds it again."""
    headers = _headers(admin_token)
    book = _create_book(client, admin_token, "Staleness Probe", "Original description.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]

    assert service.reindex_all()["indexed"] >= 1
    row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    assert row.embedding_status.value == "INDEXED"
    hash_before = row.content_hash

    update = client.put(
        f"/api/v1/books/{book['id']}",
        headers=headers,
        json={"description": "Rewritten description changes the canonical text."},
    )
    assert update.status_code == 200

    fresh_row = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    assert fresh_row.embedding_status.value == "PENDING"
    assert fresh_row.content_hash != hash_before

    rerun = service.reindex_all()
    assert rerun["indexed"] >= 1
    refreshed = (
        _request_db()
        .execute(  # type: ignore[union-attr]
            select(BookEmbedding).where(BookEmbedding.book_id == book["id"])
        )
        .scalar_one()
    )
    assert refreshed.embedding_status.value == "INDEXED"


def test_search_keeps_semantic_ranking_while_a_book_is_pending(
    client: TestClient,
    admin_token: str,  # noqa: F811
) -> None:
    """A pending book gets a text match without disabling the existing vector index."""
    headers = _headers(admin_token)
    book = _create_book(client, admin_token, "Fresh Search Title", "Original description.")
    _create_book(client, admin_token, "Indexed Search Companion", "A separate catalog topic.")
    service = EmbeddingService(_request_db())  # type: ignore[arg-type]
    assert service.reindex_all()["indexed"] >= 2

    update = client.put(
        f"/api/v1/books/{book['id']}",
        headers=headers,
        json={"title": "Fresh Search Title Revision"},
    )
    assert update.status_code == 200
    response = client.get(
        "/api/v1/books/search",
        headers=headers,
        params={"q": "Fresh Search Title Revision"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["used_semantic"] is True
    assert body["indexed_books"] >= 1
    assert body["text_match_count"] >= 1
    pending_match = next(item for item in body["results"] if item["id"] == book["id"])
    assert pending_match["score"] is None
    assert body["results"][0]["id"] == book["id"]


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
