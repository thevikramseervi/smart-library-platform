"""Link transactions to fulfilled reservations.

Adds a nullable transactions.reservation_id so issue records show which
queued reservation they satisfied, enabling queue-aware reporting.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "008_transaction_reservation_link"
down_revision: Union[str, None] = "007_missing_fk_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("reservation_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_reservation_id",
        "transactions",
        "reservations",
        ["reservation_id"],
        ["id"],
    )
    op.create_index("ix_transactions_reservation_id", "transactions", ["reservation_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_reservation_id", table_name="transactions")
    op.drop_constraint("fk_transactions_reservation_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "reservation_id")
