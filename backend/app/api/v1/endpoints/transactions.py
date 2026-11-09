"""Transaction endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.transaction import TransactionStatus
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.schemas.transaction import (
    StudentActiveTransactionResponse,
    TransactionIssueRequest,
    TransactionResponse,
    TransactionReturnRequest,
)
from app.services.transaction_service import TransactionService

router = APIRouter()


def get_transaction_service(db: Session = Depends(get_db)) -> TransactionService:
    """Provide a TransactionService for the current request."""
    return TransactionService(db)


def _is_staff(user: User) -> bool:
    """Return True when the user is admin or librarian."""
    return user.role.name.upper() in {"ADMIN", "LIBRARIAN"}


@router.post("/issue", response_model=TransactionResponse, status_code=201)
def issue_book(
    payload: TransactionIssueRequest,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Issue a book copy to a student."""
    return service.issue_copy(payload, current_user)


@router.post("/return", response_model=TransactionResponse)
def return_book(
    payload: TransactionReturnRequest,
    current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Return a borrowed book copy."""
    return service.return_copy(payload, current_user)


@router.post("/{transaction_id}/renew", response_model=TransactionResponse)
def renew_loan(
    transaction_id: UUID,
    current_user: User = Depends(require_roles("STUDENT")),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Renew an active loan owned by the authenticated student."""
    return service.renew_loan(transaction_id, current_user)


@router.get("", response_model=PaginatedResponse[TransactionResponse])
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    student_id: UUID | None = Query(default=None),
    status_filter: TransactionStatus | None = Query(default=None, alias="status"),
    overdue: bool | None = Query(default=None),
    book_id: UUID | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: TransactionService = Depends(get_transaction_service),
) -> PaginatedResponse[TransactionResponse]:
    """List circulation transactions."""
    return service.list_transactions(
        page=page,
        page_size=page_size,
        current_user=_current_user,
        is_staff=True,
        student_id=student_id,
        status_filter=status_filter,
        overdue=overdue,
        book_id=book_id,
        q=q,
    )


@router.get("/me", response_model=PaginatedResponse[TransactionResponse])
def list_my_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: TransactionStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> PaginatedResponse[TransactionResponse]:
    """List the authenticated user's transaction history."""
    return service.list_transactions(
        page=page,
        page_size=page_size,
        current_user=current_user,
        is_staff=False,
        student_id=current_user.id,
        status_filter=status_filter,
    )


@router.get("/me/active", response_model=list[StudentActiveTransactionResponse])
def list_my_active_transactions(
    current_user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> list[StudentActiveTransactionResponse]:
    """List the authenticated user's active loans."""
    return service.list_active_for_student(current_user)


@router.get("/student/{student_id}", response_model=PaginatedResponse[TransactionResponse])
def list_student_transactions(
    student_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: TransactionService = Depends(get_transaction_service),
) -> PaginatedResponse[TransactionResponse]:
    """List transactions for a specific student."""
    return service.list_transactions(
        page=page,
        page_size=page_size,
        current_user=_current_user,
        is_staff=True,
        student_id=student_id,
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Get a transaction by id."""
    return service.get_transaction(
        transaction_id,
        current_user=current_user,
        is_staff=_is_staff(current_user),
    )
