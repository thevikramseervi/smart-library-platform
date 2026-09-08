"""Add the ratings table.

One rating (1-5) per student per book, enforced by a unique constraint;
mirrors the long-planned schema design.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "012_ratings"
down_revision: Union[str, None] = "011_embedding_384_dims"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ratings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("book_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("book_id", "student_id", name="uq_ratings_book_student"),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="ck_ratings_score_range"),
    )


def downgrade() -> None:
    op.drop_table("ratings")
