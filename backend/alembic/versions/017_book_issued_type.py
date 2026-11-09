"""Allow book-issued notifications."""

from typing import Sequence, Union

from alembic import op

revision: str = "017_book_issued_type"
down_revision: Union[str, None] = "016_in_app_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notifications_type",
        "notifications",
        "notification_type IN ('BOOK_ISSUED', 'RESERVATION_READY', 'DUE_SOON', 'FINE_RECORDED')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.execute(
        "ALTER TABLE notifications ADD CONSTRAINT ck_notifications_type "
        "CHECK (notification_type IN ('RESERVATION_READY', 'DUE_SOON', 'FINE_RECORDED')) "
        "NOT VALID"
    )
