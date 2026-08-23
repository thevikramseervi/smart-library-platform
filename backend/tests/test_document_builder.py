"""Tests for search schema helpers."""

import hashlib
import uuid

import pytest

from app.models.author import Author
from app.models.book import Book
from app.models.category import Category
from app.models.language import Language
from app.models.publisher import Publisher
from app.repositories.book_repository import BookRepository
from app.search.document_builder import build_canonical_text, compute_content_hash


@pytest.fixture
def sample_book(db_session) -> Book:
    """Create a book with relations loaded for document builder tests."""
    suffix = uuid.uuid4().hex[:8]
    publisher = Publisher(name=f"Sample Publisher {suffix}")
    language = Language(name=f"English {suffix}", code=f"en-{suffix[:4]}")
    author_a = Author(name="Bob Author")
    author_b = Author(name="Ada Author")
    category_a = Category(name="Science")
    category_b = Category(name="Fiction")
    book = Book(
        title="Sample Book",
        isbn="978-0000000001",
        publisher=publisher,
        language=language,
        publication_year=2024,
        description="A sample description.",
        authors=[author_b, author_a],
        categories=[category_b, category_a],
    )
    db_session.add(book)
    db_session.flush()

    loaded = BookRepository(db_session).get_active_by_id(book.id)
    assert loaded is not None
    return loaded


def test_build_canonical_text_orders_authors_and_categories(sample_book: Book) -> None:
    """Canonical text should be deterministic regardless of relation load order."""
    text = build_canonical_text(sample_book)

    assert "Title: Sample Book" in text
    assert "Authors: Ada Author; Bob Author" in text
    assert "Categories: Fiction; Science" in text
    assert sample_book.publisher.name in text
    assert sample_book.language.name in text
    assert "ISBN: 978-0000000001" in text


def test_compute_content_hash_matches_sha256(sample_book: Book) -> None:
    """Content hash should match SHA-256 of canonical text."""
    canonical_text = build_canonical_text(sample_book)

    assert compute_content_hash(canonical_text) == hashlib.sha256(
        canonical_text.encode("utf-8")
    ).hexdigest()
