"""Add the circulation_policies table.

Stores dynamic circulation policy parameters including fine rates, fine caps,
loan durations, concurrent loan limits, and reservation expiry.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013_circulation_policies"
down_revision: Union[str, None] = "012_ratings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    table = op.create_table(
        "circulation_policies",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("daily_overdue_fine_rate", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("max_fine_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("loan_period_days", sa.Integer(), nullable=False),
        sa.Column("max_active_loans", sa.Integer(), nullable=False),
        sa.Column("reservation_expiry_days", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "daily_overdue_fine_rate >= 0",
            name="ck_circulation_policies_rate_nonnegative",
        ),
        sa.CheckConstraint(
            "max_fine_amount >= 0",
            name="ck_circulation_policies_max_fine_nonnegative",
        ),
        sa.CheckConstraint(
            "loan_period_days > 0",
            name="ck_circulation_policies_loan_period_positive",
        ),
        sa.CheckConstraint(
            "max_active_loans > 0",
            name="ck_circulation_policies_max_loans_positive",
        ),
        sa.CheckConstraint(
            "reservation_expiry_days > 0",
            name="ck_circulation_policies_reservation_expiry_positive",
        ),
    )

    op.bulk_insert(
        table,
        [
            {
                "name": "Default Policy",
                "daily_overdue_fine_rate": 10.00,
                "max_fine_amount": 500.00,
                "loan_period_days": 14,
                "max_active_loans": 5,
                "reservation_expiry_days": 7,
                "is_active": True,
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("circulation_policies")
