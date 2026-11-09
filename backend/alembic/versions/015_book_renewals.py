"""Add configurable loan renewals."""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "015_book_renewals"
down_revision: Union[str, None] = "014_model_index_alignment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("renewal_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_check_constraint(
        "ck_transactions_renewal_count_nonnegative",
        "transactions",
        "renewal_count >= 0",
    )
    op.add_column(
        "circulation_policies",
        sa.Column("max_renewals", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_check_constraint(
        "ck_circulation_policies_max_renewals_range",
        "circulation_policies",
        "max_renewals BETWEEN 0 AND 5",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_circulation_policies_max_renewals_range",
        "circulation_policies",
        type_="check",
    )
    op.drop_column("circulation_policies", "max_renewals")
    op.drop_constraint(
        "ck_transactions_renewal_count_nonnegative",
        "transactions",
        type_="check",
    )
    op.drop_column("transactions", "renewal_count")
