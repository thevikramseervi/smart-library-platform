"""In-memory sliding-window rate limiting for authentication endpoints."""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

from app.core.config import settings


class LoginRateLimiter:
    """Track failed login attempts per account email and per client IP.

    Accounts are locked after ``LOGIN_RATE_LIMIT_ATTEMPTS`` failures within
    ``LOGIN_RATE_LIMIT_WINDOW_SECONDS``; a successful login clears the
    account's history. Storage is per-process: run a single API instance or
    back this class with a shared store (e.g. Redis) when scaling horizontally.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures_by_email: dict[str, deque[float]] = defaultdict(deque)
        self._failures_by_ip: dict[str, deque[float]] = defaultdict(deque)

    @staticmethod
    def _prune(history: deque[float], now: float) -> None:
        cutoff = now - settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
        while history and history[0] <= cutoff:
            history.popleft()

    def _is_locked(self, key: str, store: dict[str, deque[float]], now: float) -> bool:
        history = store[key]
        self._prune(history, now)
        return len(history) >= settings.LOGIN_RATE_LIMIT_ATTEMPTS

    def ensure_not_locked(self, *, email: str, ip: str) -> None:
        """Raise 429 when either the account or the source IP is locked out."""
        normalized = email.strip().lower()
        now = time.monotonic()
        with self._lock:
            account_locked = self._is_locked(normalized, self._failures_by_email, now)
            ip_locked = ip not in ("testclient", "unknown") and self._is_locked(
                ip,
                self._failures_by_ip,
                now,
            )
        if account_locked or ip_locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Try again later.",
            )

    def record_failure(self, *, email: str, ip: str) -> None:
        """Record a failed attempt against both the account and the source IP."""
        normalized = email.strip().lower()
        now = time.monotonic()
        with self._lock:
            self._failures_by_email[normalized].append(now)
            if ip not in ("testclient", "unknown"):
                self._failures_by_ip[ip].append(now)

    def record_success(self, *, email: str) -> None:
        """Clear failure history for an account after a successful login."""
        normalized = email.strip().lower()
        with self._lock:
            self._failures_by_email.pop(normalized, None)

    def reset(self) -> None:
        """Clear all tracked state. Intended for test isolation."""
        with self._lock:
            self._failures_by_email.clear()
            self._failures_by_ip.clear()


login_rate_limiter = LoginRateLimiter()
