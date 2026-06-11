"""Catalog import tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal, engine
from app.db.import_catalog import CatalogImporter, ImportStats
from app.db.open_library_client import InMemoryBookMetadataClient, OpenLibraryBookRecord
from app.models.author import Author
from app.models.book import Book
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.category import Category
from app.models.language import Language
from app.models.publisher import Publisher
from app.db.seed import seed_languages


@pytest.fixture
def db_session():
    """Provide a database session rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    seed_languages(session)
    session.flush()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def _write_manifest(path: Path, entries: list[dict[str, str]]) -> None:
    path.write_text(json.dumps(entries), encoding="utf-8")


def _sample_records() -> dict[str, OpenLibraryBookRecord]:
    return {
        "9780132350884": OpenLibraryBookRecord(
            isbn="9780132350884",
            title="Clean Code",
            authors=["Robert C. Martin"],
            publishers=["Prentice Hall"],
            publication_year=2008,
            description="A handbook of agile software craftsmanship.",
        ),
        "9780201633610": OpenLibraryBookRecord(
            isbn="9780201633610",
            title="Design Patterns",
            authors=["Erich Gamma", "Richard Helm"],
            publishers=["Addison-Wesley"],
            publication_year=1994,
            description="Elements of reusable object-oriented software.",
        ),
        "9780135957059": OpenLibraryBookRecord(
            isbn="9780135957059",
            title="The Pragmatic Programmer",
            authors=["Robert C. Martin", "David Thomas"],
            publishers=["Addison-Wesley"],
            publication_year=2019,
            description="Your journey to mastery.",
        ),
    }


def test_successful_import(db_session, tmp_path: Path) -> None:
    """Importer creates books, entities, and copies from manifest metadata."""
    manifest = tmp_path / "manifest.json"
    _write_manifest(
        manifest,
        [
            {"isbn": "9780132350884", "category": "Software Engineering"},
            {"isbn": "9780201633610", "category": "Software Engineering"},
        ],
    )
    client = InMemoryBookMetadataClient(_sample_records())
    importer = CatalogImporter(db_session, metadata_client=client, manifest_path=manifest)

    stats = importer.import_catalog(clear_existing=True, commit=False)

    assert isinstance(stats, ImportStats)
    assert stats.books_imported == 2
    assert stats.copies_generated >= 4
    assert db_session.execute(select(func.count()).select_from(Book)).scalar_one() == 2
    assert db_session.execute(select(func.count()).select_from(BookCopy)).scalar_one() == stats.copies_generated


def test_author_and_publisher_reuse(db_session, tmp_path: Path) -> None:
    """Shared authors and publishers are reused across books."""
    manifest = tmp_path / "manifest.json"
    _write_manifest(
        manifest,
        [
            {"isbn": "9780132350884", "category": "Software Engineering"},
            {"isbn": "9780135957059", "category": "Programming"},
        ],
    )
    client = InMemoryBookMetadataClient(_sample_records())
    importer = CatalogImporter(db_session, metadata_client=client, manifest_path=manifest)
    stats = importer.import_catalog(clear_existing=True, commit=False)

    author_count = db_session.execute(select(func.count()).select_from(Author)).scalar_one()
    publisher_count = db_session.execute(select(func.count()).select_from(Publisher)).scalar_one()
    category_count = db_session.execute(select(func.count()).select_from(Category)).scalar_one()

    assert stats.books_imported == 2
    robert_count = db_session.execute(
        select(func.count()).select_from(Author).where(Author.name == "Robert C. Martin"),
    ).scalar_one()
    assert robert_count == 1
    assert author_count < 4
    assert publisher_count == 2
    assert category_count >= 2
    assert stats.author_reuse_count >= 1


def test_category_reuse(db_session, tmp_path: Path) -> None:
    """Categories are created once and reused."""
    manifest = tmp_path / "manifest.json"
    _write_manifest(
        manifest,
        [
            {"isbn": "9780132350884", "category": "Software Engineering"},
            {"isbn": "9780201633610", "category": "Software Engineering"},
        ],
    )
    client = InMemoryBookMetadataClient(_sample_records())
    importer = CatalogImporter(db_session, metadata_client=client, manifest_path=manifest)
    stats = importer.import_catalog(clear_existing=True, commit=False)

    se_count = db_session.execute(
        select(func.count()).select_from(Category).where(Category.name == "Software Engineering"),
    ).scalar_one()
    assert se_count == 1
    assert stats.category_reuse_count >= 1


def test_duplicate_isbn_protection(db_session, tmp_path: Path) -> None:
    """Duplicate ISBNs within one import run are only persisted once."""
    manifest = tmp_path / "manifest.json"
    _write_manifest(
        manifest,
        [
            {"isbn": "9780132350884", "category": "Software Engineering"},
            {"isbn": "9780132350884", "category": "Programming"},
        ],
    )
    client = InMemoryBookMetadataClient(_sample_records())
    importer = CatalogImporter(db_session, metadata_client=client, manifest_path=manifest)
    stats = importer.import_catalog(clear_existing=True, commit=False)

    assert stats.books_imported == 1
    assert stats.duplicate_isbns_skipped == 1
    assert db_session.execute(select(func.count()).select_from(Book)).scalar_one() == 1


def test_copy_generation_distribution(db_session, tmp_path: Path) -> None:
    """Copies are available inventory with 2–5 copies per title."""
    manifest = tmp_path / "manifest.json"
    _write_manifest(
        manifest,
        [{"isbn": "9780132350884", "category": "Software Engineering"}],
    )
    client = InMemoryBookMetadataClient(_sample_records())
    importer = CatalogImporter(db_session, metadata_client=client, manifest_path=manifest)
    stats = importer.import_catalog(clear_existing=True, commit=False)

    copies = db_session.execute(select(BookCopy)).scalars().all()
    assert 2 <= len(copies) <= 5
    assert all(copy.inventory_code.startswith("ACC-") for copy in copies)
    assert all(copy.status == BookCopyStatus.AVAILABLE for copy in copies)
    assert stats.copies_generated == len(copies)
