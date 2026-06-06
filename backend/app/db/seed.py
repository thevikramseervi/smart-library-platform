"""Database seed script for local development."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import setup_logging
from app.core.security import hash_password
from app.models.department import Department
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger(__name__)

ROLE_NAMES = ("ADMIN", "LIBRARIAN", "STUDENT")

SAMPLE_DEPARTMENTS = (
    {"name": "Computer Science", "code": "CSE", "description": "Computer Science and Engineering"},
    {
        "name": "Electronics",
        "code": "ECE",
        "description": "Electronics and Communication Engineering",
    },
)


def seed_roles(db: Session) -> dict[str, Role]:
    """Insert default roles if they do not exist."""
    roles: dict[str, Role] = {}
    for name in ROLE_NAMES:
        role = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
        if role is None:
            role = Role(name=name)
            db.add(role)
            logger.info("Created role: %s", name)
        roles[name] = role
    db.flush()
    return roles


def seed_departments(db: Session) -> list[Department]:
    """Insert sample departments for local development."""
    departments: list[Department] = []
    for dept_data in SAMPLE_DEPARTMENTS:
        department = db.execute(
            select(Department).where(Department.code == dept_data["code"])
        ).scalar_one_or_none()
        if department is None:
            department = Department(**dept_data)
            db.add(department)
            logger.info("Created department: %s", dept_data["code"])
        departments.append(department)
    db.flush()
    return departments


def seed_dev_admin(db: Session, admin_role: Role) -> None:
    """Insert a default admin user for local development and testing."""
    existing = db.execute(
        select(User).where(User.email == settings.DEV_ADMIN_EMAIL)
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("Dev admin user already exists: %s", settings.DEV_ADMIN_EMAIL)
        return

    admin = User(
        role_id=admin_role.id,
        department_id=None,
        first_name=settings.DEV_ADMIN_FIRST_NAME,
        last_name=settings.DEV_ADMIN_LAST_NAME,
        email=settings.DEV_ADMIN_EMAIL,
        password_hash=hash_password(settings.DEV_ADMIN_PASSWORD),
        semester=None,
        is_active=True,
    )
    db.add(admin)
    logger.info("Created dev admin user: %s", settings.DEV_ADMIN_EMAIL)


def run_seed() -> None:
    """Run all seed operations."""
    setup_logging()
    db = SessionLocal()
    try:
        roles = seed_roles(db)
        seed_departments(db)
        seed_dev_admin(db, roles["ADMIN"])
        db.commit()
        logger.info("Database seed completed successfully")
    except Exception:
        db.rollback()
        logger.exception("Database seed failed")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
