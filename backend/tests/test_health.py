"""Health endpoint tests."""


def test_health_returns_ok(client) -> None:
    """Health check should report API and database connectivity."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
