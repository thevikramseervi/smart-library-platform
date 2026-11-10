"""Rating endpoint and business-rule tests."""

import uuid

from fastapi.testclient import TestClient

from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    student2_token,
    student_token,
)


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_student_can_rate_once_then_update(
    client: TestClient,
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Upsert semantics: second PUT updates instead of duplicating."""
    book_id = catalog_book_with_copy["book_id"]
    headers = _headers(student_token)

    first = client.put(f"/api/v1/books/{book_id}/rating", headers=headers, json={"score": 4})
    assert first.status_code == 200
    assert first.json()["score"] == 4

    second = client.put(f"/api/v1/books/{book_id}/rating", headers=headers, json={"score": 5})
    assert second.status_code == 200
    assert second.json()["score"] == 5

    mine = client.get(f"/api/v1/books/{book_id}/ratings/me", headers=headers)
    assert mine.status_code == 200
    assert mine.json()["score"] == 5


def test_rating_summary_aggregates_across_students(
    client: TestClient,
    student_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Average and count reflect every rater."""
    book_id = catalog_book_with_copy["book_id"]
    client.put(
        f"/api/v1/books/{book_id}/rating",
        headers=_headers(student_token),
        json={"score": 2},
    )
    client.put(
        f"/api/v1/books/{book_id}/rating",
        headers=_headers(student2_token),
        json={"score": 5},
    )

    summary = client.get(f"/api/v1/books/{book_id}/ratings", headers=_headers(student_token))
    assert summary.status_code == 200
    body = summary.json()
    assert body["count"] == 2
    assert abs(body["average"] - 3.5) < 1e-6


def test_score_bounds_rejected(
    client: TestClient,
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Scores outside 1..5 fail validation."""
    book_id = catalog_book_with_copy["book_id"]
    headers = _headers(student_token)

    for score in (0, 6):
        response = client.put(
            f"/api/v1/books/{book_id}/rating",
            headers=headers,
            json={"score": score},
        )
        assert response.status_code == 422


def test_staff_cannot_rate(
    client: TestClient,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    """Ratings are student-only."""
    response = client.put(
        f"/api/v1/books/{catalog_book_with_copy['book_id']}/rating",
        headers=_headers(admin_token),
        json={"score": 5},
    )
    assert response.status_code == 403


def test_delete_missing_rating_404(
    client: TestClient,
    student_token: str,  # noqa: F811
) -> None:
    response = client.delete(
        f"/api/v1/books/{uuid.uuid4()}/rating",
        headers=_headers(student_token),
    )
    assert response.status_code == 404


def test_unknown_book_404_on_rate(
    client: TestClient,
    student_token: str,  # noqa: F811
) -> None:
    response = client.put(
        f"/api/v1/books/{uuid.uuid4()}/rating",
        headers=_headers(student_token),
        json={"score": 3},
    )
    assert response.status_code == 404


def test_student_can_create_edit_and_remove_written_review(
    client: TestClient,
    student_token: str,  # noqa: F811
    student2_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    book_id = catalog_book_with_copy["book_id"]
    student_headers = _headers(student_token)
    other_student_headers = _headers(student2_token)
    review_url = f"/api/v1/books/{book_id}/review"
    reviews_url = f"/api/v1/books/{book_id}/reviews"

    no_rating = client.put(review_url, headers=other_student_headers, json={"review_text": "Nice"})
    assert no_rating.status_code == 409

    rated = client.put(
        f"/api/v1/books/{book_id}/rating",
        headers=student_headers,
        json={"score": 4},
    )
    assert rated.status_code == 200

    created = client.put(
        review_url,
        headers=student_headers,
        json={"review_text": "  Clear explanations and useful examples.  "},
    )
    assert created.status_code == 200
    assert created.json()["review_text"] == "Clear explanations and useful examples."

    listed = client.get(reviews_url, headers=other_student_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["review_text"] == "Clear explanations and useful examples."
    assert listed.json()["items"][0]["score"] == 4
    assert listed.json()["items"][0]["reviewer_name"]

    updated = client.put(
        review_url,
        headers=student_headers,
        json={"review_text": "Updated review."},
    )
    assert updated.status_code == 200
    assert updated.json()["score"] == 4
    assert updated.json()["review_text"] == "Updated review."

    changed_score = client.put(
        f"/api/v1/books/{book_id}/rating",
        headers=student_headers,
        json={"score": 5},
    )
    assert changed_score.status_code == 200
    assert changed_score.json()["review_text"] == "Updated review."

    removed = client.delete(review_url, headers=student_headers)
    assert removed.status_code == 204
    mine = client.get(f"/api/v1/books/{book_id}/ratings/me", headers=student_headers)
    assert mine.status_code == 200
    assert mine.json()["score"] == 5
    assert mine.json()["review_text"] is None
    assert client.get(reviews_url, headers=student_headers).json()["total"] == 0

    client.put(review_url, headers=student_headers, json={"review_text": "Removed with rating"})
    deleted_rating = client.delete(
        f"/api/v1/books/{book_id}/rating",
        headers=student_headers,
    )
    assert deleted_rating.status_code == 204
    assert client.get(f"/api/v1/books/{book_id}/ratings/me", headers=student_headers).json() is None
    assert client.get(reviews_url, headers=student_headers).json()["total"] == 0


def test_review_text_validation_and_student_permissions(
    client: TestClient,
    student_token: str,  # noqa: F811
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    book_id = catalog_book_with_copy["book_id"]
    review_url = f"/api/v1/books/{book_id}/review"
    student_headers = _headers(student_token)
    assert (
        client.put(
            f"/api/v1/books/{book_id}/rating",
            headers=student_headers,
            json={"score": 3},
        ).status_code
        == 200
    )

    for text in ("   ", "x" * 2001):
        response = client.put(review_url, headers=student_headers, json={"review_text": text})
        assert response.status_code == 422

    assert (
        client.put(
            review_url,
            headers=_headers(admin_token),
            json={"review_text": "Staff cannot review"},
        ).status_code
        == 403
    )


def test_summary_of_unrated_book_is_null_average(
    client: TestClient,
    admin_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
) -> None:
    summary = client.get(
        f"/api/v1/books/{catalog_book_with_copy['book_id']}/ratings",
        headers=_headers(admin_token),
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["count"] == 0
    assert body["average"] is None
