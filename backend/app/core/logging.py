"""Application logging configuration."""

import logging
import sys


def setup_logging() -> None:
    """Configure structured application logging."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
