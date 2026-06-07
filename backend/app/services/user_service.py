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


class UserService:
    """Service layer for admin user management."""

    def __init__(self, db: Session) -> None:
        self.repository = UserRepository(db)
        self.role_repository = RoleRepository(db)
        self.department_repository = DepartmentRepository(db)
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return department

    def _validate_role_fields(
        self,
        *,
        role_name: str,
        department_id: UUID | None,
        student_code: str | None,
        semester: int | None,
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
            if semester is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Students must have a semester",
                )
            return

        if student_code is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{role_name} users cannot have a student code",
            )
        if semester is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{role_name} users cannot have a semester",
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

    def create_user(self, payload: UserCreate) -> UserResponse:
        """Create a user with hashed password."""
        role = self._get_role(payload.role_id)
        department = self._get_department(payload.department_id)
        self._validate_role_fields(
            role_name=role.name,
            department_id=payload.department_id,
            student_code=payload.student_code,
            semester=payload.semester,
        )

        if self.repository.get_by_email(payload.email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )
        if payload.student_code and self.repository.get_by_student_code(payload.student_code) is not None:
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
            semester=payload.semester,
            is_active=payload.is_active,
        )
        created = self.repository.create(user)
        commit_or_raise_conflict(
            self.db,
            detail="Email or student code already exists",
        )
        refreshed = self.repository.get_by_id_with_relations(created.id)
        assert refreshed is not None
        return self._to_response(refreshed)

    def update_user(self, user_id: UUID, payload: UserUpdate, *, actor_id: UUID) -> UserResponse:
        """Update an existing user."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        next_role = self._get_role(payload.role_id) if payload.role_id is not None else user.role
        next_department_id = (
            payload.department_id if "department_id" in payload.model_fields_set else user.department_id
        )
        next_student_code = (
            payload.student_code if "student_code" in payload.model_fields_set else user.student_code
        )
        next_semester = payload.semester if "semester" in payload.model_fields_set else user.semester

        if payload.role_id is not None and next_role.name != "ADMIN" and user.role.name == "ADMIN":
            self._ensure_last_admin_guard(user, action="demote the last active admin from")

        if payload.is_active is False:
            self._ensure_not_self(actor_id, user.id, "deactivate")
            self._ensure_last_admin_guard(user, action="deactivate the last active admin")

        if payload.role_id is not None:
            user.role_id = next_role.id
        if "department_id" in payload.model_fields_set:
            self._get_department(next_department_id)
            user.department_id = next_department_id
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
        if "semester" in payload.model_fields_set:
            user.semester = next_semester
        if payload.is_active is not None:
            user.is_active = payload.is_active

        self._validate_role_fields(
            role_name=next_role.name,
            department_id=user.department_id,
            student_code=user.student_code,
            semester=user.semester,
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
        actor_id: UUID,
    ) -> None:
        """Reset a user's password without an email workflow."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        user.password_hash = hash_password(payload.password)
        self.db.commit()

    def deactivate_user(self, user_id: UUID, *, actor_id: UUID) -> None:
        """Soft delete a user and mark them inactive."""
        user = self.repository.get_by_id_with_relations(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self._ensure_not_self(actor_id, user.id, "deactivate")
        self._ensure_last_admin_guard(user, action="delete the last active admin")

        user.is_active = False
        self.repository.soft_delete(user)
        self.db.commit()
