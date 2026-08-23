"""Single source of truth for wall-clock reads.

Due dates are assigned from the UTC calendar, so every overdue comparison
must also use the UTC calendar; mixing in the server-local date produces
fined-but-not-overdue (or the reverse) states near midnight on non-UTC hosts.
"""

from datetime import UTC, date, datetime


def utc_now() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def utc_today() -> date:
    """Return the current UTC calendar date."""
    return datetime.now(UTC).date()
