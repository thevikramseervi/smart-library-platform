"""Department endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.services.department_service import DepartmentService

router = APIRouter()


def get_department_service(db: Session = Depends(get_db)) -> DepartmentService:
    """Provide a DepartmentService for the current request."""
    return DepartmentService(db)


@router.get("", response_model=list[DepartmentResponse])
def list_departments(
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DepartmentService = Depends(get_department_service),
) -> list[DepartmentResponse]:
    """List all departments."""
    return service.list_departments()


@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department(
    department_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DepartmentService = Depends(get_department_service),
) -> DepartmentResponse:
    """Get a department by id."""
    return service.get_department(department_id)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DepartmentService = Depends(get_department_service),
) -> DepartmentResponse:
    """Create a department."""
    return service.create_department(payload)


@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: UUID,
    payload: DepartmentUpdate,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DepartmentService = Depends(get_department_service),
) -> DepartmentResponse:
    """Update a department."""
    return service.update_department(department_id, payload)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: UUID,
    _current_user: User = Depends(require_roles("ADMIN")),
    service: DepartmentService = Depends(get_department_service),
) -> Response:
    """Delete a department when no users are assigned."""
    service.delete_department(department_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
