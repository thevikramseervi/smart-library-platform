"""Student book recommendation tests."""

from uuid import uuid4

from fastapi.testclient import TestClient

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
    assert recommended["reason"] == f"Because you liked {category.json()['name']} books"
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
