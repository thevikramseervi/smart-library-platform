"""Record which staff member processed each book return."""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "010_transaction_returned_by"
down_revision: Union[str, None] = "009_user_token_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("returned_by", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_returned_by",
        "transactions",
        "users",
        ["returned_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_returned_by", "transactions", type_="foreignkey")
    op.drop_column("transactions", "returned_by")
