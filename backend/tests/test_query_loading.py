"""Query-count checks for the authenticated circulation hot paths."""

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.repositories.auth_repository import AuthRepository
from app.repositories.transaction_repository import TransactionRepository


def test_authentication_loads_role_and_department_in_one_query(
    db_session: Session, catalog_book_with_copy: dict,
) -> None:
    statements: list[str] = []
    connection = db_session.connection()

    def capture(_conn, _cursor, statement, _parameters, _context, _executemany) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(connection, "before_cursor_execute", capture)
    try:
        user = AuthRepository(db_session).get_by_id(UUID(catalog_book_with_copy["student_id"]))
        assert user is not None
        assert user.role.name == "STUDENT"
        _ = user.department
    finally:
        event.remove(connection, "before_cursor_execute", capture)
    assert len(statements) == 1


def test_active_loan_details_load_in_one_query(
    client: TestClient, db_session: Session, admin_token: str, catalog_book_with_copy: dict,
) -> None:
    response = client.post(
        "/api/v1/transactions/issue",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "book_copy_id": catalog_book_with_copy["copy_id"],
            "student_id": catalog_book_with_copy["student_id"],
        },
    )
    assert response.status_code == 201
    db_session.expire_all()
    statements: list[str] = []
    connection = db_session.connection()

    def capture(_conn, _cursor, statement, _parameters, _context, _executemany) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(connection, "before_cursor_execute", capture)
    try:
        loans = TransactionRepository(db_session).list_active_for_student(
            UUID(catalog_book_with_copy["student_id"])
        )
        loan = next(item for item in loans if str(item.id) == response.json()["id"])
        assert loan.book_copy.book.title
        assert loan.student.first_name
        assert loan.issuer.first_name
        _ = loan.fine
    finally:
        event.remove(connection, "before_cursor_execute", capture)
    assert len(statements) == 1
