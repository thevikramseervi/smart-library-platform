"""Department business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.db_errors import commit_or_raise_conflict
from app.models.department import Department
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.services.audit_log_service import AuditLogService


class DepartmentService:
    """Service layer for department management."""

    def __init__(self, db: Session) -> None:
        self.repository = DepartmentRepository(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db

    def list_departments(self) -> list[DepartmentResponse]:
        """Return all departments ordered by code."""
        departments = self.repository.list_all()
        return [DepartmentResponse.model_validate(department) for department in departments]

    def get_department(self, department_id: UUID) -> DepartmentResponse:
        """Return a department by id."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )
        return DepartmentResponse.model_validate(department)

    def create_department(self, payload: DepartmentCreate, actor: User) -> DepartmentResponse:
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
        self.audit_log_service.record(
            actor=actor,
            action="DEPARTMENT_CREATED",
            entity_type="DEPARTMENT",
            entity_id=created.id,
            summary=f'Created department "{created.name}" ({created.code})',
            details={
                "name": created.name,
                "code": created.code,
                "description": created.description,
            },
        )
        commit_or_raise_conflict(self.db, detail="Department code already exists")
        self.db.refresh(created)
        return DepartmentResponse.model_validate(created)

    def update_department(
        self,
        department_id: UUID,
        payload: DepartmentUpdate,
        actor: User,
    ) -> DepartmentResponse:
        """Update a department."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        before = {
            "name": department.name,
            "code": department.code,
            "description": department.description,
        }

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

        after = {
            "name": department.name,
            "code": department.code,
            "description": department.description,
        }
        changes = {
            key: {"before": before[key], "after": after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            self.audit_log_service.record(
                actor=actor,
                action="DEPARTMENT_UPDATED",
                entity_type="DEPARTMENT",
                entity_id=department.id,
                summary=f'Updated department "{department.name}" ({department.code})',
                details={"changes": changes},
            )

        commit_or_raise_conflict(self.db, detail="Department code already exists")
        self.db.refresh(department)
        return DepartmentResponse.model_validate(department)

    def delete_department(self, department_id: UUID, actor: User) -> None:
        """Hard delete a department when no users reference it."""
        department = self.repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        if self.repository.count_users(department_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Department has assigned users and cannot be deleted",
            )

        details = {
            "name": department.name,
            "code": department.code,
            "description": department.description,
        }
        self.repository.delete(department)
        self.audit_log_service.record(
            actor=actor,
            action="DEPARTMENT_DELETED",
            entity_type="DEPARTMENT",
            entity_id=department_id,
            summary=f'Deleted department "{details["name"]}" ({details["code"]})',
            details=details,
        )
        self.db.commit()
