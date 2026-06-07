"""Add RETIRED to bookcopystatus enum."""

from typing import Sequence, Union

from alembic import op

revision: str = "004_book_copy_retired_status"
down_revision: Union[str, None] = "003_circulation_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE bookcopystatus ADD VALUE IF NOT EXISTS 'RETIRED'")


def downgrade() -> None:
    """PostgreSQL does not support removing enum values safely."""
    pass
