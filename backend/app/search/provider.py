"""Text embedding providers for semantic search."""

from __future__ import annotations

import logging
from threading import Lock
from time import perf_counter
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)

_model_singleton: object | None = None
_model_lock = Lock()
_provider_lock = Lock()


class EmbeddingProvider(Protocol):
    """Anything that can turn texts into fixed-size vectors."""

    @property
    def model_name(self) -> str: ...

    @property
    def dimensions(self) -> int: ...

    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...


class FastEmbedProvider:
    """ONNX-based embedder via fastembed.

    The model is loaded lazily and cached process-wide so the web worker
    only pays the cost when semantic search is actually exercised.
    """

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model = None

    def _ensure_model(self):
        global _model_singleton
        if self._model is None:
            with _model_lock:
                if self._model is None:
                    if _model_singleton is None:
                        from fastembed import TextEmbedding

                        logger.info("Loading embedding model %s", self._model_name)
                        started = perf_counter()
                        _model_singleton = TextEmbedding(model_name=self._model_name)
                        logger.info(
                            "Embedding model loaded in %.2f ms", (perf_counter() - started) * 1000
                        )
                    self._model = _model_singleton
        return self._model

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimensions(self) -> int:
        model = self._ensure_model()
        return len(next(iter(model.embed(["probe"]))))

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._ensure_model()
        return [vector.tolist() for vector in model.embed(texts)]


_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    """Return the configured provider instance (cached)."""
    global _provider
    if _provider is None:
        with _provider_lock:
            if _provider is None:
                _provider = FastEmbedProvider(settings.EMBEDDING_MODEL)
    return _provider


def set_embedding_provider(provider: EmbeddingProvider | None) -> None:
    """Override the cached provider. Intended for tests."""
    global _provider
    with _provider_lock:
        _provider = provider
