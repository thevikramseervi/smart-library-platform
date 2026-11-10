"""Measure request processing until response headers are ready."""

import logging
from time import perf_counter

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("app.request_timing")


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Log route-level durations without request bodies, query strings, or IDs."""

    async def dispatch(self, request: Request, call_next):
        started = perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            elapsed_ms = (perf_counter() - started) * 1000
            response.headers.append("Server-Timing", f"app;dur={elapsed_ms:.2f}")
            return response
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            route = request.scope.get("route")
            route_path = getattr(route, "path", "<unmatched>")
            logger.info(
                "request method=%s route=%s status=%s duration_ms=%.2f",
                request.method,
                route_path,
                status_code,
                elapsed_ms,
            )
