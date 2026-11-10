"""Replace student semester with optional admission year."""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "023_student_admission_year"
down_revision: Union[str, None] = "022_digital_resources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing semester numbers do not identify an admission year, so do not
    # reinterpret them. Existing accounts receive NULL until an admin fills it.
    op.add_column("users", sa.Column("admission_year", sa.Integer(), nullable=True))
    op.drop_column("users", "semester")


def downgrade() -> None:
    # Semester values cannot be reconstructed from admission years.
    op.add_column("users", sa.Column("semester", sa.Integer(), nullable=True))
    op.drop_column("users", "admission_year")
