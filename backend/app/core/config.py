"""Application configuration loaded from environment variables."""

from decimal import Decimal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the Smart Library Platform backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

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


settings = Settings()
