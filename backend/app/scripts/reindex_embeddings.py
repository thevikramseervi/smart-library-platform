"""Re-embed all stale active books for semantic search."""

from __future__ import annotations

import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Index (or re-index) book embeddings for semantic search.",
    )
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--limit", type=int, default=None, help="Max books to process")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-embed even books whose stored hash matches current content",
    )
    args = parser.parse_args()

    from app.core.database import SessionLocal
    from app.core.logging import setup_logging
    from app.services.embedding_service import EmbeddingService

    setup_logging()
    db = SessionLocal()
    try:
        service = EmbeddingService(db)
        stats = service.reindex_all(
            batch_size=args.batch_size,
            force=args.force,
            limit=args.limit,
        )
        print(
            f"Done. scanned={stats['scanned']} indexed={stats['indexed']} failed={stats['failed']}"
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
