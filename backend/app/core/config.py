"""Application configuration loaded from environment variables."""

from decimal import Decimal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRETS = frozenset(
    {
        "change-me-in-production",
        "dev-secret-key-change-in-production",
        "secret",
        "secretkey",
    }
)


class Settings(BaseSettings):
    """Runtime settings for the Smart Library Platform backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALLOW_INSECURE_SECRETS: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    CLOUD_STORAGE_BUCKET: str = ""
    CLOUD_STORAGE_KEY: str = ""
    CLOUD_STORAGE_SECRET: str = ""
    CLOUD_STORAGE_ENDPOINT: str = ""

    DEV_ADMIN_EMAIL: str = "admin@library.local"
    DEV_ADMIN_PASSWORD: str = "admin123456"
    DEV_ADMIN_FIRST_NAME: str = "System"
    DEV_ADMIN_LAST_NAME: str = "Admin"

    DEV_LIBRARIAN_EMAIL: str = "librarian@library.local"
    DEV_LIBRARIAN_PASSWORD: str = "librarian123456"
    DEV_LIBRARIAN_FIRST_NAME: str = "Dev"
    DEV_LIBRARIAN_LAST_NAME: str = "Librarian"

    LOAN_PERIOD_DAYS: int = 14
    RESERVATION_EXPIRY_DAYS: int = 7
    DAILY_OVERDUE_FINE_RATE: Decimal = Decimal("10.00")
    MAX_FINE_AMOUNT: Decimal = Decimal("500.00")
    MAX_ACTIVE_LOANS: int = 5

    LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300

    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    SEMANTIC_SEARCH_ENABLED: bool = True

    @model_validator(mode="after")
    def _reject_insecure_jwt_secret(self) -> "Settings":
        """Fail startup when the JWT secret is missing, weak, or a known default."""
        if self.ALLOW_INSECURE_SECRETS:
            return self
        secret = self.JWT_SECRET_KEY.strip()
        if not secret or secret.lower() in INSECURE_JWT_SECRETS or len(secret) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be a strong unique value of at least 32 characters. "
                "Set ALLOW_INSECURE_SECRETS=true only for local development/testing."
            )
        return self


settings = Settings()
