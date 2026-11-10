"""Access tokens revoked before their natural expiry."""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RevokedToken(Base):
    """Store a token digest rather than the bearer token itself."""

    __tablename__ = "revoked_tokens"

    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
