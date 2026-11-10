"""Administrative circulation report tests."""

from fastapi.testclient import TestClient

from app.core.clock import utc_today


def test_dashboard_overview_matches_report_and_is_admin_only(
    client: TestClient,
    admin_token: str,
    librarian_token: str,
    student_token: str,
) -> None:
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    overview = client.get("/api/v1/reports/circulation/overview", headers=admin_headers)
    report = client.get("/api/v1/reports/circulation", headers=admin_headers)
    assert overview.status_code == report.status_code == 200
    assert all(value == report.json()[key] for key, value in overview.json().items())
    for token in (librarian_token, student_token):
        response = client.get(
            "/api/v1/reports/circulation/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


def test_admin_circulation_report_counts_issues_and_returns(
    client: TestClient,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    today = utc_today().isoformat()
    copy = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=headers,
        json={"book_copy_id": copy["copy_id"], "student_id": copy["student_id"]},
    )
    assert issue.status_code == 201
    returned = client.post(
        "/api/v1/transactions/return",
        headers=headers,
        json={"book_copy_id": copy["copy_id"]},
    )
    assert returned.status_code == 200

    response = client.get(
        "/api/v1/reports/circulation",
        headers=headers,
        params={"start_date": today, "end_date": today},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["start_date"] == today
    assert payload["end_date"] == today
    assert payload["loans_issued"] == 1
    assert payload["returns_processed"] == 1
    assert payload["overdue_at_period_end"] == 0
    assert payload["fines_collected"] == "0.00"
    assert payload["on_time_returns"] == 1
    assert payload["late_returns"] == 0
    assert float(payload["on_time_return_rate_percent"]) == 100.0
    assert payload["average_days_late"] is None
    assert payload["current_unpaid_fine_balance"] == "0.00"
    assert len(payload["popular_books"]) == 1
    assert payload["popular_books"][0]["book_title"].startswith("Circulation Book ")
    assert payload["popular_books"][0]["loans_issued"] == 1
    cse_participation = next(
        item for item in payload["department_participation"]
        if item["department_name"] == "Computer Science"
    )
    assert cse_participation["borrowing_students"] >= 1
    assert cse_participation["loans_issued"] >= 1


def test_circulation_report_is_admin_only(
    client: TestClient,
    librarian_token: str,
    student_token: str,
) -> None:
    librarian_headers = {"Authorization": f"Bearer {librarian_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    assert client.get("/api/v1/reports/circulation", headers=librarian_headers).status_code == 403
    assert client.get("/api/v1/reports/circulation", headers=student_headers).status_code == 403


def test_circulation_report_rejects_invalid_period(
    client: TestClient,
    admin_token: str,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    today = utc_today().isoformat()

    response = client.get(
        "/api/v1/reports/circulation",
        headers=headers,
        params={"start_date": "2999-01-01", "end_date": today},
    )
    assert response.status_code == 422

    future_response = client.get(
        "/api/v1/reports/circulation",
        headers=headers,
        params={"end_date": "2999-01-01"},
    )
    assert future_response.status_code == 422


def test_circulation_report_tracks_reservation_fulfillment(
    client: TestClient,
    admin_token: str,
    student2_token: str,
    catalog_book_with_copy: dict,
) -> None:
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    waiting_student_headers = {"Authorization": f"Bearer {student2_token}"}
    today = utc_today().isoformat()
    copy = catalog_book_with_copy

    issue = client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"], "student_id": copy["student_id"]},
    )
    assert issue.status_code == 201

    reservation = client.post(
        "/api/v1/reservations",
        headers=waiting_student_headers,
        json={"book_id": copy["book_id"]},
    )
    assert reservation.status_code == 201

    returned = client.post(
        "/api/v1/transactions/return",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"]},
    )
    assert returned.status_code == 200
    waiting_student = client.get("/api/v1/auth/me", headers=waiting_student_headers).json()
    fulfilled = client.post(
        "/api/v1/transactions/issue",
        headers=admin_headers,
        json={"book_copy_id": copy["copy_id"], "student_id": waiting_student["id"]},
    )
    assert fulfilled.status_code == 201

    response = client.get(
        "/api/v1/reports/circulation",
        headers=admin_headers,
        params={"start_date": today, "end_date": today},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["reservations_placed"] == 1
    assert payload["reservations_fulfilled"] == 1
    assert payload["reservations_expired"] == 0
    assert payload["reservations_cancelled"] == 0
    assert float(payload["average_reservation_wait_days"]) >= 0
    assert payload["reservation_trend"][0]["reservations_placed"] == 1
    assert payload["reservation_trend"][0]["reservations_fulfilled"] == 1


def test_circulation_report_includes_inventory_health(
    client: TestClient,
    admin_token: str,
    catalog_book_with_copy: dict,
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    today = utc_today().isoformat()

    response = client.get(
        "/api/v1/reports/circulation",
        headers=headers,
        params={"start_date": today, "end_date": today},
    )

    assert response.status_code == 200
    payload = response.json()
    inventory = payload["inventory_status"]
    assert inventory["total_copies"] >= 1
    assert inventory["available_copies"] >= 1
    quiet_title = next(
        book for book in payload["no_loan_books"]
        if book["book_title"].startswith("Circulation Book ")
    )
    assert quiet_title["available_copies"] == 1
    assert payload["no_loan_title_count"] >= 1
