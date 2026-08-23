"""Canonical document text builder for search indexing."""

from __future__ import annotations

import hashlib

from app.models.book import Book


def build_canonical_text(book: Book) -> str:
    """Build deterministic embed/FTS source text from catalog metadata.

    Requires ``book.publisher``, ``book.language``, ``book.authors``, and
    ``book.categories`` to be loaded when called from indexing jobs.
    """
    authors = "; ".join(sorted(author.name for author in book.authors))
    categories = "; ".join(sorted(category.name for category in book.categories))
    publisher_name = book.publisher.name if book.publisher is not None else ""
    language_name = book.language.name if book.language is not None else ""

    lines = [
        f"Title: {book.title}",
        f"Authors: {authors}",
        f"Categories: {categories}",
        f"Publisher: {publisher_name}",
        f"Language: {language_name}",
    ]

    if book.publication_year is not None:
        lines.append(f"Year: {book.publication_year}")
    if book.isbn:
        lines.append(f"ISBN: {book.isbn}")
    if book.edition:
        lines.append(f"Edition: {book.edition}")
    if book.description:
        lines.append(f"Description: {book.description}")

    return "\n".join(lines)


def compute_content_hash(canonical_text: str) -> str:
    """Return the SHA-256 hex digest of canonical text."""
    return hashlib.sha256(canonical_text.encode("utf-8")).hexdigest()
