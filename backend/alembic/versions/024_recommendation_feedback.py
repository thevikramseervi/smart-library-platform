"""Persist student feedback for recommendations."""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "024_recommendation_feedback"
down_revision: Union[str, None] = "023_student_admission_year"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recommendation_feedback",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("book_id", sa.UUID(), nullable=False),
        sa.Column("signal", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "signal IN ('LIKE', 'DISMISS')", name="ck_recommendation_feedback_signal"
        ),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id", "book_id", name="uq_recommendation_feedback_student_book"
        ),
    )
    op.create_index("ix_recommendation_feedback_book_id", "recommendation_feedback", ["book_id"])


def downgrade() -> None:
    op.drop_index("ix_recommendation_feedback_book_id", table_name="recommendation_feedback")
    op.drop_table("recommendation_feedback")
