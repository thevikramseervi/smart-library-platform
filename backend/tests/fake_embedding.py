"""Deterministic in-memory embedder for semantic-search tests."""

import re

from app.search.provider import EmbeddingProvider


class FakeEmbeddingProvider(EmbeddingProvider):
    """Maps texts to stable bag-of-words hash vectors — no model, no network.

    Each token hashes to a bucket; texts sharing vocabulary land close in
    cosine space, so realistic query/document overlap produces meaningful
    similarity while staying fully deterministic across runs.
    """

    DIMENSIONS = 384

    def __init__(self) -> None:
        self.calls: list[str] = []

    @property
    def model_name(self) -> str:
        return "fake-embedder"

    @property
    def dimensions(self) -> int:
        return self.DIMENSIONS

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * self.DIMENSIONS
        for token in re.findall(r"[a-z0-9]+", text.lower()):
            vector[hash(token) % self.DIMENSIONS] += 1.0
        return vector

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        self.calls.extend(texts)
        return [self._vector(text) for text in texts]
