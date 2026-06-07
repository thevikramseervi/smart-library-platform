"""Admin user and department management tests."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings


def _admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


def _create_department(client: TestClient, admin_token: str, suffix: str) -> dict:
    response = client.post(
        "/api/v1/departments",
        headers=_admin_headers(admin_token),
        json={
            "name": f"Test Department {suffix}",
            "code": f"T{suffix[:6].upper()}",
            "description": "Test department",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_roles_list_admin_only(client: TestClient, admin_token: str, librarian_token: str) -> None:
    """Admin can list roles; librarian cannot."""
    admin_response = client.get("/api/v1/roles", headers=_admin_headers(admin_token))
    assert admin_response.status_code == 200
    names = {role["name"] for role in admin_response.json()}
    assert names == {"ADMIN", "LIBRARIAN", "STUDENT"}

    librarian_response = client.get(
        "/api/v1/roles",
        headers={"Authorization": f"Bearer {librarian_token}"},
    )
    assert librarian_response.status_code == 403


def test_department_crud_and_delete_guard(
    client: TestClient,
    admin_token: str,
    librarian_token: str,
) -> None:
    """Admin can manage departments; delete blocked when users assigned."""
    suffix = uuid.uuid4().hex[:8]
    department = _create_department(client, admin_token, suffix)

    blocked = client.post(
        "/api/v1/departments",
        headers=_admin_headers(admin_token),
        json={"name": "Duplicate", "code": department["code"]},
    )
    assert blocked.status_code == 409

    librarian_list = client.get(
        "/api/v1/departments",
        headers={"Authorization": f"Bearer {librarian_token}"},
    )
    assert librarian_list.status_code == 403

    roles = client.get("/api/v1/roles", headers=_admin_headers(admin_token)).json()
    student_role = next(role for role in roles if role["name"] == "STUDENT")

    student_email = f"dept-user-{suffix}@library.local"
    created_user = client.post(
        "/api/v1/users",
        headers=_admin_headers(admin_token),
        json={
            "role_id": student_role["id"],
            "department_id": department["id"],
            "first_name": "Dept",
            "last_name": "Student",
            "email": student_email,
            "password": "student123456",
            "student_code": f"STU-{suffix[:6].upper()}",
            "semester": 2,
        },
    )
    assert created_user.status_code == 201

    delete_blocked = client.delete(
        f"/api/v1/departments/{department['id']}",
        headers=_admin_headers(admin_token),
    )
    assert delete_blocked.status_code == 409
    assert "assigned users" in delete_blocked.json()["detail"]


def test_create_student_requires_department(client: TestClient, admin_token: str) -> None:
    """Students must have a department."""
    roles = client.get("/api/v1/roles", headers=_admin_headers(admin_token)).json()
    student_role = next(role for role in roles if role["name"] == "STUDENT")
    suffix = uuid.uuid4().hex[:8]

    response = client.post(
        "/api/v1/users",
        headers=_admin_headers(admin_token),
        json={
            "role_id": student_role["id"],
            "department_id": None,
            "first_name": "No",
            "last_name": "Department",
            "email": f"no-dept-{suffix}@library.local",
            "password": "student123456",
            "student_code": f"STU-{suffix[:6].upper()}",
            "semester": 1,
        },
    )
    assert response.status_code == 422


def test_create_student_login_and_deactivate(
    client: TestClient,
    admin_token: str,
) -> None:
    """Admin-created student can log in until deactivated."""
    suffix = uuid.uuid4().hex[:8]
    department = _create_department(client, admin_token, suffix)
    roles = client.get("/api/v1/roles", headers=_admin_headers(admin_token)).json()
    student_role = next(role for role in roles if role["name"] == "STUDENT")

    email = f"new-student-{suffix}@library.local"
    password = "student123456"
    student_code = f"STU-{suffix[:6].upper()}"

    created = client.post(
        "/api/v1/users",
        headers=_admin_headers(admin_token),
        json={
            "role_id": student_role["id"],
            "department_id": department["id"],
            "first_name": "New",
            "last_name": "Student",
            "email": email,
            "password": password,
            "student_code": student_code,
            "semester": 3,
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200

    reset = client.post(
        f"/api/v1/users/{user_id}/reset-password",
        headers=_admin_headers(admin_token),
        json={"password": "newpassword123"},
    )
    assert reset.status_code == 204

    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "newpassword123"},
    )
    assert new_login.status_code == 200

    deactivated = client.delete(
        f"/api/v1/users/{user_id}",
        headers=_admin_headers(admin_token),
    )
    assert deactivated.status_code == 204

    blocked_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "newpassword123"},
    )
    assert blocked_login.status_code == 401


def test_admin_cannot_deactivate_self(client: TestClient, admin_token: str) -> None:
    """Admin cannot deactivate their own account."""
    me = client.get("/api/v1/auth/me", headers=_admin_headers(admin_token)).json()
    response = client.delete(
        f"/api/v1/users/{me['id']}",
        headers=_admin_headers(admin_token),
    )
    assert response.status_code == 409
    assert "your own account" in response.json()["detail"]


def test_users_rbac(client: TestClient, librarian_token: str, student_token: str) -> None:
    """Non-admin roles cannot access user management."""
    lib_headers = {"Authorization": f"Bearer {librarian_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    assert client.get("/api/v1/users", headers=lib_headers).status_code == 403
    assert client.get("/api/v1/users", headers=student_headers).status_code == 403


def test_list_users_pagination(client: TestClient, admin_token: str) -> None:
    """User list returns paginated results."""
    response = client.get(
        "/api/v1/users",
        headers=_admin_headers(admin_token),
        params={"page": 1, "page_size": 5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert "total_pages" in payload
    assert payload["page"] == 1
    assert len(payload["items"]) <= 5

    seeded = next(
        item for item in payload["items"] if item["email"] == settings.DEV_ADMIN_EMAIL
    )
    assert seeded["role"]["name"] == "ADMIN"
    assert "password_hash" not in seeded
