"""FastAPI application entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from threading import Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.logging import setup_logging
from app.core.request_timing import RequestTimingMiddleware
from app.search.provider import get_embedding_provider

logger = logging.getLogger(__name__)


def _prewarm_embedding_model() -> None:
    """Load the search model off the startup path; search can retry failures later."""
    try:
        get_embedding_provider().embed_texts(["library book"])
    except Exception:  # noqa: BLE001 - startup and keyword fallback must remain available
        logger.warning("Embedding model prewarm failed; search will retry on demand", exc_info=True)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown lifecycle."""
    setup_logging()
    if settings.SEMANTIC_SEARCH_ENABLED and settings.SEMANTIC_SEARCH_PREWARM_ENABLED:
        Thread(target=_prewarm_embedding_model, name="embedding-prewarm", daemon=True).start()
    yield
    engine.dispose()


app = FastAPI(
    title="Smart Library Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(RequestTimingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Server-Timing"],
)

app.include_router(api_router, prefix="/api/v1")
