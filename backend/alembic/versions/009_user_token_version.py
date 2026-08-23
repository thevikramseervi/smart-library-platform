"""Invalidate outstanding JWTs on password reset.

Adds users.token_version; tokens carry the version at issue time and are
rejected once it no longer matches, so a password reset immediately kills
stolen sessions.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_user_token_version"
down_revision: Union[str, None] = "008_transaction_reservation_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
