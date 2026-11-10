"""Language business logic."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.language import Language
from app.models.user import User
from app.repositories.language_repository import LanguageRepository
from app.schemas.language import LanguageCreate, LanguageResponse
from app.services.audit_log_service import AuditLogService


class LanguageService:
    """Service layer for language management."""

    def __init__(self, db: Session) -> None:
        self.repository = LanguageRepository(db)
        self.audit_log_service = AuditLogService(db)
        self.db = db

    def list_languages(self) -> list[LanguageResponse]:
        """Return all languages."""
        languages = self.repository.list_all()
        return [LanguageResponse.model_validate(lang) for lang in languages]

    def create_language(self, payload: LanguageCreate, actor: User) -> LanguageResponse:
        """Create a language with unique name and code."""
        if self.repository.get_by_code(payload.code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Language code already exists",
            )
        if self.repository.get_by_name(payload.name) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Language name already exists",
            )

        language = Language(name=payload.name, code=payload.code)
        created = self.repository.create(language)
        self.audit_log_service.record(
            actor=actor,
            action="LANGUAGE_CREATED",
            entity_type="LANGUAGE",
            entity_id=created.id,
            summary=f'Created language "{created.name}" ({created.code})',
            details={"name": created.name, "code": created.code},
        )
        self.db.commit()
        self.db.refresh(created)
        return LanguageResponse.model_validate(created)
