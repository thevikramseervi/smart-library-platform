"""Nonblocking semantic model prewarm behavior."""

import asyncio
import sys
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app import main
from app.search import provider


def test_concurrent_model_initialization_uses_one_instance(monkeypatch) -> None:
    model = object()
    factory = Mock(return_value=model)
    monkeypatch.setattr(provider, "_model_singleton", None)
    monkeypatch.setitem(sys.modules, "fastembed", SimpleNamespace(TextEmbedding=factory))
    embedding_provider = provider.FastEmbedProvider("test-model")

    with ThreadPoolExecutor(max_workers=4) as executor:
        instances = list(executor.map(lambda _: embedding_provider._ensure_model(), range(8)))

    assert all(instance is model for instance in instances)
    factory.assert_called_once_with(model_name="test-model")


def test_prewarm_failure_does_not_raise(monkeypatch) -> None:
    embedding_provider = SimpleNamespace(embed_texts=Mock(side_effect=RuntimeError("unavailable")))
    monkeypatch.setattr(main, "get_embedding_provider", lambda: embedding_provider)

    main._prewarm_embedding_model()

    embedding_provider.embed_texts.assert_called_once_with(["library book"])


@pytest.mark.parametrize("search_enabled,prewarm_enabled,expected", [
    (True, True, True), (True, False, False), (False, True, False),
])
def test_startup_only_schedules_enabled_prewarm(
    monkeypatch, search_enabled: bool, prewarm_enabled: bool, expected: bool,
) -> None:
    worker = Mock()
    thread_factory = Mock(return_value=worker)
    monkeypatch.setattr(main, "Thread", thread_factory)
    monkeypatch.setattr(main, "setup_logging", lambda: None)
    monkeypatch.setattr(main, "engine", SimpleNamespace(dispose=Mock()))
    monkeypatch.setattr(main, "settings", SimpleNamespace(
        SEMANTIC_SEARCH_ENABLED=search_enabled,
        SEMANTIC_SEARCH_PREWARM_ENABLED=prewarm_enabled,
    ))

    async def run_lifespan() -> None:
        async with main.lifespan(main.app):
            pass

    asyncio.run(run_lifespan())
    assert thread_factory.called is expected
    assert worker.start.called is expected
