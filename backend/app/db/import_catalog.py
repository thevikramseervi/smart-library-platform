"""Import a realistic academic library catalog from Open Library metadata."""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.catalog_categories import CATEGORY_DEFINITIONS
from app.db.open_library_client import (
    BookMetadataClient,
    OpenLibraryBookRecord,
    OpenLibraryClient,
    normalize_isbn,
)
from app.models.author import Author
from app.models.book import Book
from app.models.book_author import BookAuthor
from app.models.book_category import BookCategory
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.category import Category
from app.models.fine import Fine
from app.models.language import Language
from app.models.publisher import Publisher
from app.models.reservation import Reservation
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

MANIFEST_PATH = Path(__file__).parent / "data" / "catalog_manifest.json"

COPY_LOCATIONS = (
    "Stack A — Computer Science",
    "Stack B — Software Engineering",
    "Stack C — Mathematics",
    "Reference — Core Texts",
    "Reserve — High Demand",
)


@dataclass
class ImportStats:
    """Summary of a catalog import run."""

    books_imported: int = 0
    books_skipped: int = 0
    authors_created: int = 0
    publishers_created: int = 0
    categories_created: int = 0
    copies_generated: int = 0
    duplicate_isbns_skipped: int = 0
    failed_lookups: int = 0
    author_reuse_count: int = 0
    publisher_reuse_count: int = 0
    category_reuse_count: int = 0
    errors: list[str] = field(default_factory=list)


class CatalogImporter:
    """Fresh catalog importer with entity reuse and copy generation."""

    def __init__(
        self,
        db: Session,
        *,
        metadata_client: BookMetadataClient | None = None,
        manifest_path: Path = MANIFEST_PATH,
        random_seed: int = 42,
    ) -> None:
        self.db = db
        self.metadata_client = metadata_client or OpenLibraryClient()
        self.manifest_path = manifest_path
        self.random = random.Random(random_seed)

        self._authors_by_name: dict[str, Author] = {}
        self._publishers_by_name: dict[str, Publisher] = {}
        self._categories_by_name: dict[str, Category] = {}
        self._categories_assigned: set[str] = set()
        self._language_by_code: dict[str, Language] = {}
        self._seen_isbns: set[str] = set()
        self._accession_counter = 0

    def load_manifest(self) -> list[dict[str, str]]:
        """Load curated ISBN manifest."""
        entries = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        return [{"isbn": normalize_isbn(item["isbn"]), "category": item["category"]} for item in entries]

    def clear_catalog_tables(self) -> None:
        """Remove catalog and circulation data while preserving users and languages."""
        logger.info("Clearing catalog-related tables for fresh import")
        for statement in (
            delete(Fine),
            delete(Transaction),
            delete(Reservation),
            delete(BookCopy),
            delete(BookAuthor),
            delete(BookCategory),
            delete(Book),
            delete(Author),
            delete(Publisher),
            delete(Category),
        ):
            self.db.execute(statement)
            self.db.flush()

    def _assert_catalog_empty(self) -> None:
        book_count = self.db.execute(select(func.count()).select_from(Book)).scalar_one()
        if book_count > 0:
            raise RuntimeError(
                "Catalog tables are not empty. Run a fresh import with clear_catalog_tables() first.",
            )

    def _seed_categories(self, stats: ImportStats) -> None:
        for name, description in CATEGORY_DEFINITIONS.items():
            existing = self.db.execute(
                select(Category).where(Category.name == name, Category.deleted_at.is_(None)),
            ).scalar_one_or_none()
            if existing is None:
                category = Category(name=name, description=description)
                self.db.add(category)
                stats.categories_created += 1
            else:
                category = existing
                stats.category_reuse_count += 1
            self._categories_by_name[name] = category
        self.db.flush()

    def _load_languages(self) -> None:
        languages = self.db.execute(select(Language)).scalars().all()
        self._language_by_code = {language.code: language for language in languages}
        if "en" not in self._language_by_code:
            raise RuntimeError("English language (code=en) must exist before catalog import.")

    def _get_or_create_author(self, name: str, stats: ImportStats) -> Author:
        key = name.strip()
        if key in self._authors_by_name:
            stats.author_reuse_count += 1
            return self._authors_by_name[key]

        existing = self.db.execute(
            select(Author).where(Author.name == key, Author.deleted_at.is_(None)),
        ).scalar_one_or_none()
        if existing is None:
            author = Author(name=key)
            self.db.add(author)
            stats.authors_created += 1
        else:
            author = existing
            stats.author_reuse_count += 1
        self._authors_by_name[key] = author
        self.db.flush()
        return author

    def _get_or_create_publisher(self, name: str, stats: ImportStats) -> Publisher:
        key = name.strip()
        if key in self._publishers_by_name:
            stats.publisher_reuse_count += 1
            return self._publishers_by_name[key]

        existing = self.db.execute(
            select(Publisher).where(Publisher.name == key, Publisher.deleted_at.is_(None)),
        ).scalar_one_or_none()
        if existing is None:
            publisher = Publisher(name=key)
            self.db.add(publisher)
            stats.publishers_created += 1
        else:
            publisher = existing
            stats.publisher_reuse_count += 1
        self._publishers_by_name[key] = publisher
        self.db.flush()
        return publisher

    def _default_publisher(self, stats: ImportStats) -> Publisher:
        return self._get_or_create_publisher("Unknown Publisher", stats)

    def _create_book(
        self,
        record: OpenLibraryBookRecord,
        category_name: str,
        stats: ImportStats,
    ) -> Book | None:
        isbn = normalize_isbn(record.isbn)
        if isbn in self._seen_isbns:
            stats.duplicate_isbns_skipped += 1
            return None

        existing = self.db.execute(
            select(Book).where(Book.isbn == isbn, Book.deleted_at.is_(None)),
        ).scalar_one_or_none()
        if existing is not None:
            stats.duplicate_isbns_skipped += 1
            self._seen_isbns.add(isbn)
            return None

        publisher_name = record.publishers[0] if record.publishers else "Unknown Publisher"
        publisher = self._get_or_create_publisher(publisher_name, stats)
        language = self._language_by_code.get(record.language_code, self._language_by_code["en"])
        category = self._categories_by_name.get(category_name)
        if category is None:
            category = self._categories_by_name["Computer Science"]
        if category_name in self._categories_assigned:
            stats.category_reuse_count += 1
        else:
            self._categories_assigned.add(category_name)

        book = Book(
            title=record.title,
            isbn=isbn,
            publisher_id=publisher.id,
            language_id=language.id,
            publication_year=record.publication_year,
            description=record.description,
            cover_image_url=record.cover_image_url,
            is_digital=False,
        )
        self.db.add(book)
        self.db.flush()

        author_names = record.authors or ["Unknown Author"]
        authors = [self._get_or_create_author(name, stats) for name in author_names]
        book.authors = authors
        book.categories = [category]
        self.db.flush()

        self._seen_isbns.add(isbn)
        stats.books_imported += 1
        return book

    def _next_accession_code(self) -> str:
        self._accession_counter += 1
        return f"ACC-{self._accession_counter:06d}"

    def generate_copies_for_books(self, books: list[Book], stats: ImportStats) -> None:
        """Generate 2–5 available copies per book with realistic accession numbers."""
        for book in books:
            copy_count = self.random.randint(2, 5)
            for _ in range(copy_count):
                inventory_code = self._next_accession_code()
                copy = BookCopy(
                    book_id=book.id,
                    inventory_code=inventory_code,
                    qr_code_value=inventory_code,
                    location=self.random.choice(COPY_LOCATIONS),
                    status=BookCopyStatus.AVAILABLE,
                    acquired_date=date.today(),
                )
                self.db.add(copy)
                stats.copies_generated += 1
        self.db.flush()

    def import_catalog(
        self,
        *,
        clear_existing: bool = True,
        commit: bool = True,
    ) -> ImportStats:
        """Run a full fresh catalog import."""
        stats = ImportStats()
        manifest = self.load_manifest()
        isbns = [entry["isbn"] for entry in manifest]

        # Fetch remote metadata before DB writes so the session is not idle during API calls.
        metadata = self.metadata_client.fetch_batch(isbns)

        if clear_existing:
            self.clear_catalog_tables()
        else:
            self._assert_catalog_empty()

        self._seed_categories(stats)
        self._load_languages()

        imported_books: list[Book] = []

        for entry in manifest:
            isbn = entry["isbn"]
            record = metadata.get(isbn)
            if record is None:
                stats.failed_lookups += 1
                stats.books_skipped += 1
                stats.errors.append(f"No metadata found for ISBN {isbn}")
                continue

            book = self._create_book(record, entry["category"], stats)
            if book is not None:
                imported_books.append(book)

        self.generate_copies_for_books(imported_books, stats)
        if commit:
            self.db.commit()
        else:
            self.db.flush()
        logger.info(
            "Catalog import complete: %s books, %s copies",
            stats.books_imported,
            stats.copies_generated,
        )
        return stats


def run_catalog_import(*, clear_existing: bool = True, use_network: bool = True) -> ImportStats:
    """CLI entrypoint helper for catalog import."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        client = OpenLibraryClient(use_network=use_network)
        importer = CatalogImporter(db, metadata_client=client)
        return importer.import_catalog(clear_existing=clear_existing)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    from app.core.logging import setup_logging

    parser = argparse.ArgumentParser(description="Import real library catalog from Open Library")
    parser.add_argument(
        "--no-clear",
        action="store_true",
        help="Skip clearing catalog tables (fails if catalog is not empty)",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use only cached Open Library responses",
    )
    args = parser.parse_args()
    setup_logging()
    stats = run_catalog_import(clear_existing=not args.no_clear, use_network=not args.offline)
    print(
        json.dumps(
            {
                "books_imported": stats.books_imported,
                "authors_created": stats.authors_created,
                "publishers_created": stats.publishers_created,
                "categories_created": stats.categories_created,
                "copies_generated": stats.copies_generated,
                "duplicate_isbns_skipped": stats.duplicate_isbns_skipped,
                "failed_lookups": stats.failed_lookups,
            },
            indent=2,
        ),
    )
