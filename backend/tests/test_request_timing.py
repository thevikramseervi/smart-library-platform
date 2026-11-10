"""Tests for request timing without a database connection."""

import asyncio
import logging

import httpx
from fastapi import FastAPI

from app.core.request_timing import RequestTimingMiddleware


def test_timing_header_and_log_use_route_template(caplog) -> None:
    app = FastAPI()
    app.add_middleware(RequestTimingMiddleware)

    @app.get("/books/{book_id}")
    async def get_book(book_id: str) -> dict[str, str]:
        return {"id": book_id}

    async def request() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.get("/books/private-id?token=private-token")

    with caplog.at_level(logging.INFO, logger="app.request_timing"):
        response = asyncio.run(request())

    assert response.status_code == 200
    assert response.headers["server-timing"].startswith("app;dur=")
    assert "route=/books/{book_id}" in caplog.text
    assert "status=200" in caplog.text
    assert "private-id" not in caplog.text
    assert "private-token" not in caplog.text
