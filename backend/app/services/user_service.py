"""Admin user management business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.db_errors import commit_or_raise_conflict
from app.core.security import hash_password
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse
from app.schemas.pagination import PaginatedResponse
from app.schemas.user_admin import UserCreate, UserPasswordReset, UserUpdate
from app.services.audit_log_service import AuditLogService


class UserService:
    """Service layer for admin user management."""

    def __init__(self, db: Session) -> None:
        self.repository = UserRepository(db)
        self.role_repository = RoleRepository(db)
        self.department_repository = DepartmentRepository(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db

    def _to_response(self, user: User) -> UserResponse:
        """Build a user API response."""
        return UserResponse.model_validate(user)

    def _get_role(self, role_id: UUID):
        """Load a role or raise 404."""
        role = self.role_repository.get_by_id(role_id)
        if role is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        return role

    def _get_department(self, department_id: UUID | None):
        """Load a department when provided or raise 404."""
        if department_id is None:
            return None
        department = self.department_repository.get_by_id(department_id)
        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )
        return department

    def _validate_role_fields(
        self,
        *,
        role_name: str,
        department_id: UUID | None,
        student_code: str | None,
        admission_year: int | None,
    ) -> None:
        """Validate role-specific user fields."""
        if role_name == "STUDENT":
            if department_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Students must have a department",
                )
            if not student_code:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Students must have a student code",
                )
            return

        if student_code is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{role_name} users cannot have a student code",
            )
        if admission_year is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{role_name} users cannot have an admission year",
            )

    def _ensure_not_self(self, actor_id: UUID, target_id: UUID, action: str) -> None:
        """Prevent admins from performing destructive actions on themselves."""
        if actor_id == target_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You cannot {action} your own account",
            )

    def _ensure_last_admin_guard(self, user: User, *, action: str) -> None:
        """Prevent removing or deactivating the last active admin."""
        if user.role.name != "ADMIN" or not user.is_active:
            return
        remaining = self.repository.count_active_admins(exclude_id=user.id)
        if remaining == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot {action} the last active admin",
            )

    def list_users(
        self,
        *,
        page: int,
        page_size: int,
        q: str | None = None,
        role: str | None = None,
        department_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> PaginatedResponse[UserResponse]:
        """Return paginated users for admin."""
        items, total = self.repository.list_users(
            page=page,
            page_size=page_size,
            q=q,
            role_name=role,
            department_id=department_id,
            is_active=is_active,
        )
        responses = [self._to_response(user) for user in items]
        return PaginatedResponse.create(responses, total, page, page_size)

    def get_user(self, user_id: UUID) -> UserResponse:
        """Return a user by id."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self._to_response(user)

    def create_user(self, payload: UserCreate, actor: User) -> UserResponse:
        """Create a user with hashed password."""
        role = self._get_role(payload.role_id)
        department = self._get_department(payload.department_id)
        self._validate_role_fields(
            role_name=role.name,
            department_id=payload.department_id,
            student_code=payload.student_code,
            admission_year=payload.admission_year,
        )

        if self.repository.get_by_email(payload.email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )
        student_code_taken = payload.student_code is not None and (
            self.repository.get_by_student_code(payload.student_code) is not None
        )
        if student_code_taken:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student code already exists",
            )

        user = User(
            role_id=role.id,
            department_id=department.id if department else None,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
            student_code=payload.student_code,
            password_hash=hash_password(payload.password),
            admission_year=payload.admission_year,
            is_active=payload.is_active,
        )
        created = self.repository.create(user)
        self.audit_log_service.record(
            actor=actor,
            action="USER_CREATED",
            entity_type="USER",
            entity_id=created.id,
            summary=(
                f'Created {role.name.lower()} account for '
                f"{created.first_name} {created.last_name} ({created.email})"
            ),
            details={
                "name": f"{created.first_name} {created.last_name}".strip(),
                "email": created.email,
                "role": role.name,
                "department": department.name if department else None,
                "student_code": created.student_code,
                "is_active": created.is_active,
            },
        )
        commit_or_raise_conflict(
            self.db,
            detail="Email or student code already exists",
        )
        refreshed = self.repository.get_by_id_with_relations(created.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def update_user(self, user_id: UUID, payload: UserUpdate, *, actor: User) -> UserResponse:
        """Update an existing user."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        before = {
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "role": user.role.name,
            "department": user.department.name if user.department else None,
            "student_code": user.student_code,
            "admission_year": user.admission_year,
            "is_active": user.is_active,
        }

        next_role = self._get_role(payload.role_id) if payload.role_id is not None else user.role
        uses_field_semantics = "department_id" in payload.model_fields_set
        next_department_id = payload.department_id if uses_field_semantics else user.department_id
        sets_student_code = "student_code" in payload.model_fields_set
        next_student_code = payload.student_code if sets_student_code else user.student_code
        sets_admission_year = "admission_year" in payload.model_fields_set
        next_admission_year = payload.admission_year if sets_admission_year else user.admission_year

        if payload.role_id is not None and next_role.name != "ADMIN" and user.role.name == "ADMIN":
            self._ensure_last_admin_guard(user, action="demote the last active admin from")

        if payload.is_active is False:
            self._ensure_not_self(actor.id, user.id, "deactivate")
            self._ensure_last_admin_guard(user, action="deactivate the last active admin")

        if payload.role_id is not None:
            user.role_id = next_role.id
        if "department_id" in payload.model_fields_set:
            next_department = self._get_department(next_department_id)
            user.department_id = next_department_id
        else:
            next_department = user.department
        if payload.first_name is not None:
            user.first_name = payload.first_name
        if payload.last_name is not None:
            user.last_name = payload.last_name
        if payload.email is not None and payload.email != user.email:
            if self.repository.get_by_email(payload.email, exclude_id=user.id) is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already exists",
                )
            user.email = payload.email
        if "phone" in payload.model_fields_set:
            user.phone = payload.phone
        if payload.password is not None:
            user.password_hash = hash_password(payload.password)
            user.token_version = (user.token_version or 0) + 1
        if "student_code" in payload.model_fields_set:
            if next_student_code and self.repository.get_by_student_code(
                next_student_code,
                exclude_id=user.id,
            ) is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Student code already exists",
                )
            user.student_code = next_student_code
        if sets_admission_year:
            user.admission_year = next_admission_year
        if payload.is_active is not None:
            user.is_active = payload.is_active

        self._validate_role_fields(
            role_name=next_role.name,
            department_id=user.department_id,
            student_code=user.student_code,
            admission_year=user.admission_year,
        )

        after = {
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "role": next_role.name,
            "department": next_department.name if next_department else None,
            "student_code": user.student_code,
            "admission_year": user.admission_year,
            "is_active": user.is_active,
        }
        changes = {
            key: {"before": before[key], "after": after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            self.audit_log_service.record(
                actor=actor,
                action="USER_UPDATED",
                entity_type="USER",
                entity_id=user.id,
                summary=f'Updated account for {after["name"]} ({user.email})',
                details={"changes": changes},
            )
        if payload.password is not None:
            self.audit_log_service.record(
                actor=actor,
                action="USER_PASSWORD_RESET",
                entity_type="USER",
                entity_id=user.id,
                summary=f"Reset password for {after['name']} ({user.email})",
                details={"password_value_recorded": False},
            )

        commit_or_raise_conflict(
            self.db,
            detail="Email or student code already exists",
        )
        refreshed = self.repository.get_by_id_with_relations(user.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def reset_password(
        self,
        user_id: UUID,
        payload: UserPasswordReset,
        *,
        actor: User,
    ) -> None:
        """Reset a user's password and revoke their outstanding sessions."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        user.password_hash = hash_password(payload.password)
        user.token_version = (user.token_version or 0) + 1
        self.audit_log_service.record(
            actor=actor,
            action="USER_PASSWORD_RESET",
            entity_type="USER",
            entity_id=user.id,
            summary=f"Reset password for {user.first_name} {user.last_name} ({user.email})",
            details={"password_value_recorded": False},
        )
        self.db.commit()

    def deactivate_user(self, user_id: UUID, *, actor: User) -> None:
        """Soft delete a user and mark them inactive."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self._ensure_not_self(actor.id, user.id, "deactivate")
        self._ensure_last_admin_guard(user, action="delete the last active admin")

        user.is_active = False
        self.repository.soft_delete(user)
        self.audit_log_service.record(
            actor=actor,
            action="USER_DEACTIVATED",
            entity_type="USER",
            entity_id=user.id,
            summary=f"Deactivated account for {user.first_name} {user.last_name} ({user.email})",
            details={
                "name": f"{user.first_name} {user.last_name}".strip(),
                "email": user.email,
                "student_code": user.student_code,
            },
        )
        self.db.commit()
