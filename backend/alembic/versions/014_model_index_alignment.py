"""Align model indexes and remove a redundant fines unique index."""

from typing import Sequence, Union

from alembic import op

revision: str = "014_model_index_alignment"
down_revision: Union[str, None] = "013_circulation_policies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_book_copies_status", "book_copies", ["status"])
    op.create_index("ix_ratings_book_id", "ratings", ["book_id"])
    op.create_index("ix_ratings_student_id", "ratings", ["student_id"])
    # Migration 003 already created a UNIQUE constraint on this column.
    op.drop_index("uq_fines_transaction_id", table_name="fines")


def downgrade() -> None:
    op.create_index("uq_fines_transaction_id", "fines", ["transaction_id"], unique=True)
    op.drop_index("ix_ratings_student_id", table_name="ratings")
    op.drop_index("ix_ratings_book_id", table_name="ratings")
    op.drop_index("ix_book_copies_status", table_name="book_copies")
