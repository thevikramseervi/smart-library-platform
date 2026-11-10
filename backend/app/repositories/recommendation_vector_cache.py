"""Small process-local cache for revision-checked recommendation vectors."""

from collections import OrderedDict
from threading import Lock
from time import monotonic
from uuid import UUID


class RecommendationVectorCache:
    """Cache immutable snapshots; callers verify the database revision first."""

    def __init__(self, ttl_seconds: float = 30, max_entries: int = 4) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._lock = Lock()
        self._entries: OrderedDict[tuple[object, str], tuple[str, float, dict]] = OrderedDict()

    def get(self, key: tuple[object, str], revision: str) -> dict[UUID, list[float]] | None:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            saved_revision, expires_at, vectors = entry
            if saved_revision != revision or monotonic() >= expires_at:
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return {book_id: list(vector) for book_id, vector in vectors.items()}

    def put(self, key: tuple[object, str], revision: str, vectors: dict[UUID, list[float]]) -> None:
        snapshot = {book_id: tuple(vector) for book_id, vector in vectors.items()}
        with self._lock:
            self._entries[key] = (revision, monotonic() + self.ttl_seconds, snapshot)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)


vector_cache = RecommendationVectorCache()
