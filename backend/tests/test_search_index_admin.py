"""Admin-only controls for semantic search indexing."""

from fastapi.testclient import TestClient

from app.api.v1.endpoints import search_index
from app.services import embedding_jobs
from tests.conftest_circulation import admin_token, student_token  # noqa: F401


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_index_status_is_admin_only(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
) -> None:
    admin_response = client.get("/api/v1/search-index/status", headers=_headers(admin_token))
    student_response = client.get("/api/v1/search-index/status", headers=_headers(student_token))

    assert admin_response.status_code == 200
    assert admin_response.json()["model_name"]
    assert admin_response.json()["total_books"] == 0
    assert student_response.status_code == 403


def test_admin_can_queue_full_rebuild(
    client: TestClient,
    admin_token: str,  # noqa: F811
    monkeypatch,
) -> None:
    ran: list[tuple[str, bool]] = []
    monkeypatch.setattr(
        search_index, "run_job", lambda job_id, *, force: ran.append((job_id, force))
    )
    monkeypatch.setattr(embedding_jobs, "_job", None)
    try:
        response = client.post(
            "/api/v1/search-index/reindex",
            headers=_headers(admin_token),
            json={"force": True},
        )
        assert response.status_code == 202
        body = response.json()
        assert body["status"] == "RUNNING"
        assert body["mode"] == "FULL"
        assert ran == [(body["job_id"], True)]
    finally:
        monkeypatch.setattr(embedding_jobs, "_job", None)


def test_librarian_cannot_start_rebuild(
    client: TestClient,
    librarian_token: str,
) -> None:
    response = client.post(
        "/api/v1/search-index/reindex",
        headers=_headers(librarian_token),
        json={"force": False},
    )

    assert response.status_code == 403
