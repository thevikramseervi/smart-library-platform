"""Language repository."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.language import Language
from app.repositories.base import BaseRepository


class LanguageRepository(BaseRepository[Language]):
    """Database access for languages."""

    def __init__(self, db: Session) -> None:
        super().__init__(Language, db)

    def list_all(self) -> list[Language]:
        """Return all languages ordered by name."""
        statement = select(Language).order_by(Language.name)
        return list(self.db.execute(statement).scalars().all())

    def get_by_code(self, code: str) -> Language | None:
        """Fetch a language by its code."""
        statement = select(Language).where(Language.code == code)
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_name(self, name: str) -> Language | None:
        """Fetch a language by its name."""
        statement = select(Language).where(Language.name == name)
        return self.db.execute(statement).scalar_one_or_none()

    def count(self) -> int:
        """Return total language count."""
        statement = select(func.count()).select_from(Language)
        return self.db.execute(statement).scalar_one()

    def create(self, language: Language) -> Language:
        """Persist a new language."""
        self.db.add(language)
        self.db.flush()
        return language
