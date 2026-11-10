"""Student book recommendation tests."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.book_embedding import BookEmbedding, EmbeddingStatus
from app.repositories.recommendation_repository import RecommendationRepository
from app.services.recommendation_service import RecommendationService
from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    librarian_token,
    student2_token,
    student_token,
)


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_cosine_similarity_handles_matching_and_invalid_vectors() -> None:
    assert RecommendationService._cosine([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert RecommendationService._cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert RecommendationService._cosine([0.0, 0.0], [1.0, 0.0]) == 0.0
    assert RecommendationService._cosine([1.0], [1.0, 0.0]) == 0.0


def test_cached_similarity_matches_cosine_for_valid_and_invalid_vectors() -> None:
    ids = [uuid4() for _ in range(5)]
    vectors = dict(zip(ids, [[1.0, 0.0], [0.8, 0.6], [-1.0, 0.0], [0.0, 0.0], [1.0]], strict=True))
    similarity = RecommendationService._cached_similarity(vectors)
    for left in ids:
        for right in ids:
            assert similarity(left, right) == RecommendationService._cosine(
                vectors[left], vectors[right]
            )
    assert similarity(ids[0], uuid4()) == 0.0


def test_semantic_match_uses_the_most_relevant_positive_seed() -> None:
    candidate_id, seed_id, other_seed_id = uuid4(), uuid4(), uuid4()
    score, matched_seed = RecommendationService._semantic_matches(
        candidate_id,
        {seed_id: 1.5, other_seed_id: 1.0},
        {
            candidate_id: [1.0, 0.0],
            seed_id: [0.8, 0.6],
            other_seed_id: [0.0, 1.0],
        },
    )
    assert score == 0.8
    assert matched_seed == seed_id


def test_catalog_vectors_include_only_indexed_current_model(
    db_session: Session, catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    book_id = UUID(catalog_book_with_copy["book_id"])
    embedding = db_session.get(BookEmbedding, book_id)
    assert embedding is not None
    embedding.embedding = [1.0] + [0.0] * 383
    embedding.embedding_status = EmbeddingStatus.INDEXED
    embedding.model_name = "test-model"
    db_session.flush()

    repository = RecommendationRepository(db_session)
    books, vectors = repository.list_books_and_vectors("test-model")
    assert any(book.id == book_id for book in books)
    assert len(vectors[book_id]) == 384
    assert vectors[book_id][0] == 1.0

    # A new indexed vector must replace a cached vector, even for the same model.
    embedding.embedding = [0.0, 1.0] + [0.0] * 382
    embedding.indexed_at = datetime.now(UTC) + timedelta(seconds=1)
    db_session.flush()
    _, vectors = repository.list_books_and_vectors("test-model")
    assert vectors[book_id][:2] == [0.0, 1.0]

    embedding.embedding_status = EmbeddingStatus.PENDING
    db_session.flush()
    books, vectors = repository.list_books_and_vectors("test-model")
    assert any(book.id == book_id for book in books)
    assert book_id not in vectors

    embedding.embedding_status = EmbeddingStatus.INDEXED
    embedding.model_name = "another-model"
    db_session.flush()
    _, vectors = repository.list_books_and_vectors("test-model")
    assert book_id not in vectors


def test_recommendation_reason_does_not_compare_a_book_to_itself() -> None:
    book_id = uuid4()
    book = SimpleNamespace(title="Introduction to Algorithms", categories=[])

    reason = RecommendationService._signal_reason(
        book,
        signal="ratings",
        semantic_seed=book_id,
        semantic_score=0.9,
        book_titles={book_id: book.title},
        rating_preferences={},
        like_preferences={},
        borrow_preferences={},
        rating_averages={},
    )

    assert reason == "Based on books you rated highly"


def test_unrated_borrowed_book_is_a_positive_semantic_seed(
    client: TestClient,
    db_session: Session,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Borrowing an unrated title is positive preference evidence for semantic matching."""
    issued = client.post(
        "/api/v1/transactions/issue",
        headers=_headers(admin_token),
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert issued.status_code == 201

    seeds = RecommendationRepository(db_session).get_positive_seed_weights(
        UUID(catalog_book_with_copy["student_id"])
    )
    assert seeds[UUID(catalog_book_with_copy["book_id"])] == 0.6


def test_explicit_recommendation_feedback_is_saved_and_can_be_cleared(
    client: TestClient,
    db_session: Session,
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Likes become positive seeds, dismissals replace them, and clear removes the signal."""
    headers = _headers(student_token)
    book_id = UUID(catalog_book_with_copy["book_id"])

    liked = client.put(
        f"/api/v1/recommendations/{book_id}/feedback",
        headers=headers,
        json={"signal": "LIKE"},
    )
    assert liked.status_code == 200
    assert liked.json() == {"book_id": str(book_id), "signal": "LIKE"}
    assert (
        RecommendationRepository(db_session).get_positive_seed_weights(
            UUID(catalog_book_with_copy["student_id"])
        )[book_id]
        == 1.2
    )
    assert book_id not in RecommendationRepository(db_session).list_interacted_book_ids(
        UUID(catalog_book_with_copy["student_id"])
    )

    dismissed = client.put(
        f"/api/v1/recommendations/{book_id}/feedback",
        headers=headers,
        json={"signal": "DISMISS"},
    )
    assert dismissed.status_code == 200
    assert book_id not in RecommendationRepository(db_session).get_positive_seed_weights(
        UUID(catalog_book_with_copy["student_id"])
    )

    cleared = client.delete(f"/api/v1/recommendations/{book_id}/feedback", headers=headers)
    assert cleared.status_code == 204
    assert book_id not in RecommendationRepository(db_session).list_interacted_book_ids(
        UUID(catalog_book_with_copy["student_id"])
    )


def test_recommendations_use_positive_category_ratings_and_exclude_seen_books(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    admin_headers = _headers(admin_token)
    student_headers = _headers(student_token)
    book = client.get(
        f"/api/v1/books/{catalog_book_with_copy['book_id']}",
        headers=admin_headers,
    ).json()
    suffix = catalog_book_with_copy["inventory_code"]
    category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": f"Recommendation Category {suffix}"},
    )
    assert category.status_code == 201
    category_id = category.json()["id"]

    tagged = client.put(
        f"/api/v1/books/{book['id']}",
        headers=admin_headers,
        json={"category_ids": [category_id]},
    )
    assert tagged.status_code == 200
    liked = client.put(
        f"/api/v1/books/{book['id']}/rating",
        headers=student_headers,
        json={"score": 5},
    )
    assert liked.status_code == 200

    candidate = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={
            "title": f"Related Recommendation {suffix}",
            "publisher_id": book["publisher_id"],
            "language_id": book["language_id"],
            "category_ids": [category_id],
        },
    )
    assert candidate.status_code == 201
    candidate_copy = client.post(
        "/api/v1/book-copies",
        headers=admin_headers,
        json={
            "book_id": candidate.json()["id"],
            "inventory_code": f"REC-{suffix}",
        },
    )
    assert candidate_copy.status_code == 201

    response = client.get("/api/v1/recommendations/me", headers=student_headers)
    assert response.status_code == 200
    results = response.json()
    recommended = next(item for item in results if item["book"]["id"] == candidate.json()["id"])
    assert recommended["reason"] == f"Because you rated {category.json()['name']} books highly"
    assert all(item["book"]["id"] != book["id"] for item in results)

    limited = client.get("/api/v1/recommendations/me?limit=1", headers=student_headers)
    assert limited.status_code == 200
    assert len(limited.json()) == 1


def test_recommendations_are_student_only(
    client: TestClient,
    admin_token: str,  # noqa: F811
    librarian_token: str,  # noqa: F811
) -> None:
    admin_response = client.get(
        "/api/v1/recommendations/me",
        headers=_headers(admin_token),
    )
    assert admin_response.status_code == 403
    assert (
        client.get("/api/v1/recommendations/me", headers=_headers(librarian_token)).status_code
        == 403
    )
