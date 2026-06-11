"""Database seed script for local development."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import setup_logging
from app.core.security import hash_password
from app.models.department import Department
from app.models.language import Language
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger(__name__)

ROLE_NAMES = ("ADMIN", "LIBRARIAN", "STUDENT")

DEV_STUDENT_EMAIL = "student@library.local"
DEV_STUDENT_PASSWORD = "student123456"
DEV_STUDENT_FIRST_NAME = "Dev"
DEV_STUDENT_LAST_NAME = "Student"
DEV_STUDENT_CODE = "STU-001"

DEV_STUDENT2_EMAIL = "student2@library.local"
DEV_STUDENT2_PASSWORD = "student123456"
DEV_STUDENT2_FIRST_NAME = "Dev"
DEV_STUDENT2_LAST_NAME = "Student Two"
DEV_STUDENT2_CODE = "STU-002"

SAMPLE_DEPARTMENTS = (
    {"name": "Computer Science", "code": "CSE", "description": "Computer Science and Engineering"},
    {
        "name": "Electronics",
        "code": "ECE",
        "description": "Electronics and Communication Engineering",
    },
)

SAMPLE_LANGUAGES = (
    {"name": "English", "code": "en"},
    {"name": "Hindi", "code": "hi"},
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


def seed_dev_librarian(db: Session, librarian_role: Role) -> None:
    """Insert a default librarian user for local development and RBAC tests."""
    existing = db.execute(
        select(User).where(User.email == settings.DEV_LIBRARIAN_EMAIL)
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("Dev librarian user already exists: %s", settings.DEV_LIBRARIAN_EMAIL)
        return

    librarian = User(
        role_id=librarian_role.id,
        department_id=None,
        first_name=settings.DEV_LIBRARIAN_FIRST_NAME,
        last_name=settings.DEV_LIBRARIAN_LAST_NAME,
        email=settings.DEV_LIBRARIAN_EMAIL,
        password_hash=hash_password(settings.DEV_LIBRARIAN_PASSWORD),
        semester=None,
        is_active=True,
    )
    db.add(librarian)
    logger.info("Created dev librarian user: %s", settings.DEV_LIBRARIAN_EMAIL)


def seed_dev_student(db: Session, student_role: Role) -> None:
    """Insert a default student user for local development and RBAC tests."""
    existing = db.execute(
        select(User).where(User.email == DEV_STUDENT_EMAIL)
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("Dev student user already exists: %s", DEV_STUDENT_EMAIL)
        return

    department = db.execute(select(Department).where(Department.code == "CSE")).scalar_one_or_none()

    student = User(
        role_id=student_role.id,
        department_id=department.id if department else None,
        first_name=DEV_STUDENT_FIRST_NAME,
        last_name=DEV_STUDENT_LAST_NAME,
        email=DEV_STUDENT_EMAIL,
        student_code=DEV_STUDENT_CODE,
        password_hash=hash_password(DEV_STUDENT_PASSWORD),
        semester=3,
        is_active=True,
    )
    db.add(student)
    logger.info("Created dev student user: %s", DEV_STUDENT_EMAIL)


def seed_dev_student_two(db: Session, student_role: Role) -> None:
    """Insert a second student user for reservation queue tests."""
    existing = db.execute(
        select(User).where(User.email == DEV_STUDENT2_EMAIL)
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("Dev student two already exists: %s", DEV_STUDENT2_EMAIL)
        return

    department = db.execute(select(Department).where(Department.code == "CSE")).scalar_one_or_none()
    student = User(
        role_id=student_role.id,
        department_id=department.id if department else None,
        first_name=DEV_STUDENT2_FIRST_NAME,
        last_name=DEV_STUDENT2_LAST_NAME,
        email=DEV_STUDENT2_EMAIL,
        student_code=DEV_STUDENT2_CODE,
        password_hash=hash_password(DEV_STUDENT2_PASSWORD),
        semester=3,
        is_active=True,
    )
    db.add(student)
    logger.info("Created dev student two: %s", DEV_STUDENT2_EMAIL)


def seed_languages(db: Session) -> list[Language]:
    """Insert default languages for local development."""
    languages: list[Language] = []
    for lang_data in SAMPLE_LANGUAGES:
        language = db.execute(
            select(Language).where(Language.code == lang_data["code"])
        ).scalar_one_or_none()
        if language is None:
            language = Language(**lang_data)
            db.add(language)
            logger.info("Created language: %s", lang_data["code"])
        languages.append(language)
    db.flush()
    return languages


def run_seed(*, import_catalog: bool = False) -> None:
    """Run all seed operations."""
    setup_logging()
    db = SessionLocal()
    try:
        roles = seed_roles(db)
        seed_departments(db)
        seed_languages(db)
        seed_dev_admin(db, roles["ADMIN"])
        seed_dev_librarian(db, roles["LIBRARIAN"])
        seed_dev_student(db, roles["STUDENT"])
        seed_dev_student_two(db, roles["STUDENT"])
        db.commit()
        logger.info("Database seed completed successfully")

        if import_catalog:
            from app.db.import_catalog import CatalogImporter

            catalog_db = SessionLocal()
            try:
                importer = CatalogImporter(catalog_db)
                stats = importer.import_catalog(clear_existing=True)
                logger.info(
                    "Catalog import: %s books, %s copies, %s authors, %s publishers",
                    stats.books_imported,
                    stats.copies_generated,
                    stats.authors_created,
                    stats.publishers_created,
                )
            except Exception:
                catalog_db.rollback()
                logger.exception("Catalog import failed")
                raise
            finally:
                catalog_db.close()
    except Exception:
        db.rollback()
        logger.exception("Database seed failed")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed roles, users, and optional catalog")
    parser.add_argument(
        "--catalog",
        action="store_true",
        help="Import real library catalog from Open Library after seeding users",
    )
    args = parser.parse_args()
    run_seed(import_catalog=args.catalog)
