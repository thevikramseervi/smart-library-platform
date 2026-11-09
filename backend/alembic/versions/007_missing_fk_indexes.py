"""Add lookup indexes and a redundant fines unique index.

book_copies.book_id (issue/return and catalog copy listings),
reservations.student_id (student reservation history across all statuses),
and a UNIQUE index on fines.transaction_id were added. Migration 003 already
created a UNIQUE constraint on fines.transaction_id, so the index added here is
redundant and is removed by migration 014.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_missing_fk_indexes"
down_revision: Union[str, None] = "006_search_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_book_copies_book_id", "book_copies", ["book_id"])
    op.create_index("ix_reservations_student_id_status", "reservations", ["student_id", "status"])
    op.create_index("uq_fines_transaction_id", "fines", ["transaction_id"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_fines_transaction_id", table_name="fines")
    op.drop_index("ix_reservations_student_id_status", table_name="reservations")
    op.drop_index("ix_book_copies_book_id", table_name="book_copies")
