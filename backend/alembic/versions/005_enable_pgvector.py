"""Enable pgvector extension for semantic search."""

from typing import Sequence, Union

from alembic import op

revision: str = "005_enable_pgvector"
down_revision: Union[str, None] = "004_book_copy_retired_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
