"""Language endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.language import LanguageCreate, LanguageResponse
from app.services.language_service import LanguageService

router = APIRouter()


def get_language_service(db: Session = Depends(get_db)) -> LanguageService:
    """Provide a LanguageService for the current request."""
    return LanguageService(db)


@router.get("", response_model=list[LanguageResponse])
def list_languages(
    _current_user: User = Depends(get_current_user),
    service: LanguageService = Depends(get_language_service),
) -> list[LanguageResponse]:
    """List all languages."""
    return service.list_languages()


@router.post("", response_model=LanguageResponse, status_code=status.HTTP_201_CREATED)
def create_language(
    payload: LanguageCreate,
    _current_user: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: LanguageService = Depends(get_language_service),
) -> LanguageResponse:
    """Create a language."""
    return service.create_language(payload)
