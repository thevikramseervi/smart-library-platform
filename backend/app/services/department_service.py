"""Department business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.db_errors import commit_or_raise_conflict
from app.models.department import Department
from app.repositories.department_repository import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate


class DepartmentService:
    """Service layer for department management."""

    def __init__(self, db: Session) -> None:
        self.repository = DepartmentRepository(db)
        self.db = db

    def list_departments(self) -> list[DepartmentResponse]:
        """Return all departments ordered by code."""
        departments = self.repository.list_all()
        return [DepartmentResponse.model_validate(department) for department in departments]

    def get_department(self, department_id: UUID) -> DepartmentResponse:
        """Return a department by id."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return DepartmentResponse.model_validate(department)

    def create_department(self, payload: DepartmentCreate) -> DepartmentResponse:
        """Create a department with a unique code."""
        if self.repository.get_by_code(payload.code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Department code already exists",
            )

        department = Department(
            name=payload.name,
            code=payload.code,
            description=payload.description,
        )
        created = self.repository.create(department)
        commit_or_raise_conflict(self.db, detail="Department code already exists")
        self.db.refresh(created)
        return DepartmentResponse.model_validate(created)

    def update_department(
        self,
        department_id: UUID,
        payload: DepartmentUpdate,
    ) -> DepartmentResponse:
        """Update a department."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

        if payload.code is not None and payload.code != department.code:
            existing = self.repository.get_by_code(payload.code, exclude_id=department.id)
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Department code already exists",
                )
            department.code = payload.code

        if payload.name is not None:
            department.name = payload.name
        if payload.description is not None:
            department.description = payload.description

        commit_or_raise_conflict(self.db, detail="Department code already exists")
        self.db.refresh(department)
        return DepartmentResponse.model_validate(department)

    def delete_department(self, department_id: UUID) -> None:
        """Hard delete a department when no users reference it."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

        if self.repository.count_users(department_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Department has assigned users and cannot be deleted",
            )

        self.repository.delete(department)
        self.db.commit()
