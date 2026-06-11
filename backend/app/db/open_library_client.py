"""Open Library API client for catalog metadata import."""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)

OPEN_LIBRARY_DATA_URL = "https://openlibrary.org/api/books"
DEFAULT_CACHE_PATH = Path(__file__).parent / "data" / "open_library_cache.json"
BATCH_SIZE = 10
REQUEST_DELAY_SECONDS = 1.0
USER_AGENT = "SmartLibraryPlatform/1.0 (catalog-import; contact=dev@library.local)"


@dataclass
class OpenLibraryBookRecord:
    """Normalized book metadata from Open Library."""

    isbn: str
    title: str
    authors: list[str] = field(default_factory=list)
    publishers: list[str] = field(default_factory=list)
    publication_year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    language_code: str = "en"


class BookMetadataClient(Protocol):
    """Protocol for fetching book metadata by ISBN."""

    def fetch_by_isbn(self, isbn: str) -> OpenLibraryBookRecord | None:
        """Return metadata for a single ISBN."""

    def fetch_batch(self, isbns: list[str]) -> dict[str, OpenLibraryBookRecord]:
        """Return metadata keyed by ISBN."""


def normalize_isbn(isbn: str) -> str:
    """Strip non-digit characters except X."""
    return re.sub(r"[^0-9Xx]", "", isbn)


def _parse_year(value: str | int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value if 1000 <= value <= 2100 else None
    match = re.search(r"(19|20)\d{2}", str(value))
    return int(match.group(0)) if match else None


def _parse_description(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        text = raw.strip()
        return text or None
    if isinstance(raw, dict):
        value = raw.get("value")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _record_from_payload(isbn: str, payload: dict[str, Any]) -> OpenLibraryBookRecord | None:
    title = payload.get("title")
    if not title or not str(title).strip():
        return None

    authors = [
        author.get("name", "").strip()
        for author in payload.get("authors", [])
        if isinstance(author, dict) and author.get("name")
    ]
    publishers = [
        publisher.get("name", "").strip()
        for publisher in payload.get("publishers", [])
        if isinstance(publisher, dict) and publisher.get("name")
    ]

    cover = payload.get("cover") or {}
    cover_url = None
    if isinstance(cover, dict):
        cover_url = cover.get("large") or cover.get("medium") or cover.get("small")

    return OpenLibraryBookRecord(
        isbn=normalize_isbn(isbn),
        title=str(title).strip(),
        authors=authors,
        publishers=publishers,
        publication_year=_parse_year(payload.get("publish_date")),
        description=_parse_description(payload.get("description")),
        cover_image_url=cover_url,
    )


class OpenLibraryClient:
    """Fetch book metadata from Open Library with optional on-disk cache."""

    def __init__(
        self,
        *,
        cache_path: Path | None = DEFAULT_CACHE_PATH,
        use_network: bool = True,
        request_delay: float = REQUEST_DELAY_SECONDS,
    ) -> None:
        self.cache_path = cache_path
        self.use_network = use_network
        self.request_delay = request_delay
        self._cache: dict[str, dict[str, Any]] = {}
        if cache_path and cache_path.exists():
            self._cache = json.loads(cache_path.read_text(encoding="utf-8"))

    def _save_cache(self) -> None:
        if self.cache_path is None:
            return
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self._cache, indent=2), encoding="utf-8")

    def _fetch_description_from_edition(self, isbn: str) -> str | None:
        if not self.use_network:
            return None
        url = f"https://openlibrary.org/isbn/{isbn}.json"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                edition = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return None

        description = _parse_description(edition.get("description"))
        if description:
            return description

        works = edition.get("works") or []
        if not works:
            return None
        work_key = works[0].get("key")
        if not work_key:
            return None
        work_url = f"https://openlibrary.org{work_key}.json"
        work_request = urllib.request.Request(work_url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(work_request, timeout=20) as response:
                work = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return None
        return _parse_description(work.get("description"))

    def _fetch_remote_batch(self, isbns: list[str]) -> dict[str, OpenLibraryBookRecord]:
        if not isbns:
            return {}

        bibkeys = ",".join(f"ISBN:{normalize_isbn(isbn)}" for isbn in isbns)
        query = urllib.parse.urlencode(
            {"bibkeys": bibkeys, "format": "json", "jscmd": "data"},
        )
        url = f"{OPEN_LIBRARY_DATA_URL}?{query}"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))

        records: dict[str, OpenLibraryBookRecord] = {}
        for isbn in isbns:
            normalized = normalize_isbn(isbn)
            key = f"ISBN:{normalized}"
            item = payload.get(key)
            if not item:
                continue
            record = _record_from_payload(normalized, item)
            if record is None:
                continue
            if not record.description:
                record.description = self._fetch_description_from_edition(normalized)
            records[normalized] = record
            self._cache[normalized] = item
        return records

    def fetch_batch(self, isbns: list[str]) -> dict[str, OpenLibraryBookRecord]:
        """Fetch metadata for multiple ISBNs, using cache when available."""
        results: dict[str, OpenLibraryBookRecord] = {}
        pending: list[str] = []

        for isbn in isbns:
            normalized = normalize_isbn(isbn)
            cached = self._cache.get(normalized)
            if cached:
                record = _record_from_payload(normalized, cached)
                if record:
                    results[normalized] = record
                continue
            pending.append(normalized)

        if pending and self.use_network:
            for index in range(0, len(pending), BATCH_SIZE):
                batch = pending[index : index + BATCH_SIZE]
                try:
                    results.update(self._fetch_remote_batch(batch))
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                    logger.warning("Open Library batch failed: %s", exc)
                if index + BATCH_SIZE < len(pending):
                    time.sleep(self.request_delay)
            self._save_cache()

        return results

    def fetch_by_isbn(self, isbn: str) -> OpenLibraryBookRecord | None:
        """Fetch metadata for a single ISBN."""
        return self.fetch_batch([isbn]).get(normalize_isbn(isbn))


class InMemoryBookMetadataClient:
    """Test-friendly metadata client backed by in-memory records."""

    def __init__(self, records: dict[str, OpenLibraryBookRecord]) -> None:
        self.records = {normalize_isbn(isbn): record for isbn, record in records.items()}

    def fetch_by_isbn(self, isbn: str) -> OpenLibraryBookRecord | None:
        return self.records.get(normalize_isbn(isbn))

    def fetch_batch(self, isbns: list[str]) -> dict[str, OpenLibraryBookRecord]:
        return {
            normalize_isbn(isbn): record
            for isbn in isbns
            if (record := self.records.get(normalize_isbn(isbn))) is not None
        }
