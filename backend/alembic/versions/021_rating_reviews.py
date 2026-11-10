"""Add optional written reviews to student ratings."""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "021_rating_reviews"
down_revision: Union[str, None] = "020_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ratings", sa.Column("review_text", sa.String(length=2000), nullable=True))
    op.create_check_constraint(
        "ck_ratings_review_text_nonempty",
        "ratings",
        "review_text IS NULL OR length(btrim(review_text)) BETWEEN 1 AND 2000",
    )


def downgrade() -> None:
    op.drop_constraint("ck_ratings_review_text_nonempty", "ratings", type_="check")
    op.drop_column("ratings", "review_text")
